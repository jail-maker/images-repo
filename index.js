#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const fileType = require('file-type');
const Koa = require('koa');
const Router = require('koa-better-router');
const body = require('koa-body');

const ImageMeta = require('./libs/image-meta.js');
const ImageMetaJsonMapper = require('./libs/image-meta-json-mapper.js');

const app = new Koa();
const router = Router({ prefix: '/api/v1/' }).loadMethods();
const root = Router();

const STORAGE = './jsnap-repo';
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

    let meta = ImageMeta.fromJSON(ctx.request.body);
    let metaMapper = new ImageMetaJsonMapper('images-meta.json');
    try {

        metaMapper.create(meta);
        ctx.status = 201;

    } catch (error) {

        ctx.status = 409;

    }

    ctx.body = '';

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
        }
    };

});

router.delete('/images/:image', (ctx, next) => {

    let name = ctx.params.name;
    let metaMapper = new ImageMetaJsonMapper('images-meta.json');

    try {

        metaMapper.delete(name);
        ctx.status = 200;

    } catch (error) {

        ctx.status = 404;

    }

});


router.put('/images/:image/data', (ctx, next) => {

    let metaMapper = new ImageMetaJsonMapper('images-meta.json');

    let image = ctx.params.image;
    if (!metaMapper.has(image)) {

        ctx.status = 404;
        return;

    }

    let files = ctx.request.body.files;
    fs.renameSync(files.data.path, path.join(STORAGE, image));
    ctx.status = 200;

});

router.get('/images/:image/data', (ctx, next) => {

    let metaMapper = new ImageMetaJsonMapper('images-meta.json');
    let image = ctx.params.image;

    if (!metaMapper.has(image)) {

        ctx.status = 404;
        return;

    }

    let stream = fs.createReadStream(path.join(STORAGE, image));
    ctx.set('content-disposition', `attachment; filename="${image}"`)
    ctx.body = stream;
    return;


});

root.extend(router);
app.use(body({ multipart: true }));
app.use(root.middleware());
app.use(router.middleware());

app.listen(PORT);
