#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const Koa = require('koa');
const Router = require('koa-better-router');
const body = require('koa-body');
const getRawBody = require('raw-body');
const uniqid = require('uniqid');
const tempWrite = require('temp-write');
const tempfile = require('tempfile');
const tempdir = require('tempdir');
const mime = require('mime');

const ImageMeta = require('./libs/image-meta.js');
const ImageMetaJsonMapper = require('./libs/image-meta-json-mapper.js');
const sha256File = require('./libs/sha256-file.js');
const decompress = require('./libs/decompress.js');
const ManifestFactory = require('./libs/manifest-factory.js');

const app = new Koa();
const router = Router({ prefix: '/api/v1' }).loadMethods();
const root = Router();

const STORAGE = './jmaker-images';
const HOSTNAME = '127.0.0.1';
const PORT = 3000;

router.get('/images', (ctx, next) => {

    let metaMapper = new ImageMetaJsonMapper('images-meta.json');
    let images = metaMapper.getImages();

    let body = images.map(image => {

        return {
            name: image.name,
            links: {
                meta: `/images/${image.name}`,
                data: `/images/${image.name}/data`,
            },
        };

    });

    ctx.body = body;

});

router.post('/images', (ctx, next) => {

    let body = ctx.request.body;
    let meta = new ImageMeta;

    meta.name = body.name;
    meta.maintainer = body.maintainer;
    meta.description = body.description;
    meta.parent = body.parent;
    meta.version = body.version;

    let metaMapper = new ImageMetaJsonMapper('images-meta.json');
    try {

        metaMapper.create(meta);
        ctx.status = 201;

    } catch (error) {

        ctx.status = 409;

    }

    ctx.body = '';

});

router.post('/image-importer', async (ctx, next) => {

    let mimeType = ctx.request.headers['content-type'];
    let ext = mime.getExtension(mimeType);
    let imageFileName = `${uniqid()}.${ext}`;
    let imageFilePath = await tempWrite(ctx.request.rawBody, imageFileName);
    let tmpDir = await tempdir();
    let manifestFile = path.join(tmpDir, '.manifest');
    let manifest = {};
    let metaMapper = new ImageMetaJsonMapper('images-meta.json');
    let meta = new ImageMeta;

    fs.renameSync(imageFilePath, path.join(STORAGE, imageFileName));
    imageFilePath = path.join(STORAGE, imageFileName);

    try {

        await decompress(imageFilePath, tmpDir, {files: ['.manifest']});
        manifest = ManifestFactory.fromFile(manifestFile);

    } catch (error) {

        ctx.status = 400;
        ctx.body = "Bad image format.";
        fs.unlinkSync(imageFilePath);
        return;

    } finally {

        fs.unlinkSync(manifestFile);

    }

    meta.name = manifest.name;
    meta.parent = manifest.from;
    meta.fileName = imageFileName;
    meta.sha256 = await sha256File(imageFilePath);

    try {

        metaMapper.create(meta);
        ctx.status = 201;

    } catch (error) {

        ctx.status = 409;
        ctx.body = `Image "${meta.name}" already exists.`;
        fs.unlinkSync(imageFilePath);

    }

    return;

});

router.get('/images/:image', (ctx, next) => {

    let metaMapper = new ImageMetaJsonMapper('images-meta.json');
    let meta = {};
    try {

        meta = metaMapper.getByName(ctx.params.image);

    } catch (error) {

        ctx.status = 404;
        return;

    }

    ctx.body = {
        data: meta,
        links: {
            self: `/images/${meta.name}`,
            data: `/images/${meta.name}/data`,
            parent: meta.parent ? `/images/${meta.parent}` : null,
            parents: `/images/${meta.name}/parents`,
        }
    };

});

router.get('/images/:image/parents', (ctx, next) => {

    let image = ctx.params.image;
    let metaMapper = new ImageMetaJsonMapper('images-meta.json');
    let current = metaMapper.getByName(image);

    let getParents = (name, images = []) => {

        if (!name) return images;
        let meta = metaMapper.getByName(name);
        let data = {
            name: meta.name,
            parent: meta.parent,
            links: {
                meta: `/images/${meta.name}`,
                data: `/images/${meta.name}/data`,
                parent: meta.parent ? `/images/${meta.parent}` : null,
            }
        };
        images = getParents(meta.parent, images);
        images.push(data);
        return images;

    }

    try {

        ctx.body = getParents(current.parent);

    } catch (error) {

        ctx.status = 500;

    }

});

router.delete('/images/:image', (ctx, next) => {

    let image = ctx.params.image;
    let metaMapper = new ImageMetaJsonMapper('images-meta.json');

    try {

        let meta = metaMapper.getByName(image);
        fs.unlinkSync(path.join(STORAGE, meta.fileName));
        metaMapper.delete(image);

        ctx.status = 200;

    } catch (error) {

        ctx.status = 404;

    }

});


router.put('/images/:image/data', async (ctx, next) => {

    let metaMapper = new ImageMetaJsonMapper('images-meta.json');

    let image = ctx.params.image;
    if (!metaMapper.has(image)) {

        ctx.status = 404;
        return;

    }

    let meta = metaMapper.getByName(image);
    let files = ctx.request.body.files;

    if (meta.fileName) {

        try {

            fs.unlinkSync(path.join(STORAGE, meta.fileName));

        } catch (error) {

            console.log(error);

        }

    }

    meta.fileName = uniqid() + path.extname(files.data.name);
    meta.sha256 = await sha256File(files.data.path);

    fs.renameSync(files.data.path, path.join(STORAGE, meta.fileName));
    metaMapper.update(meta);
    ctx.status = 200;

});

router.get('/images/:image/data', (ctx, next) => {

    let metaMapper = new ImageMetaJsonMapper('images-meta.json');
    let image = ctx.params.image;

    if (!metaMapper.has(image)) {

        ctx.status = 404;
        return;

    }

    let meta = metaMapper.getByName(image);
    let stream = fs.createReadStream(path.join(STORAGE, meta.fileName));
    ctx.set('content-disposition', `attachment; filename="${meta.fileName}"`)
    ctx.set('content-type', 'application/x-xz');
    ctx.body = stream;
    return;

});

root.extend(router);
app.use(body({ multipart: true }));
app.use(async (ctx, next) => {

    ctx.request.rawBody = await getRawBody(ctx.req, { limit: '500mb' });
    await next();

});
app.use(root.middleware());
app.use(router.middleware());

app.listen(PORT);
