'use strict';

const fs = require('fs');
const ImageMeta = require('./image-meta.js');

class ImageMetaJsonMapper {

    constructor(file) {

        this._file = file;

    }

    getByName(name) {

        let data = this._read();
        if (!data.data[name])
            throw new Error(`Image "${name}" not found.`);

        return ImageMeta.fromJSON(data.data[name]);

    }

    getImages(offset = 0, limit = 100) {

        let data = this._read();
        let index = data.index.slice(offset, limit);

        let images = index.map(name => data.data[name]);
        return images;

    }

    save(image) {

        let data = this._read();
        data.data[image.name] = image;

        data.index = [];
        for (let key in data.data) data.index.push(key);

        this._write(data);

    }

    create(image) {

        if (this.has(image.name))
            throw new Error(`Image "${image.name} already exists."`);

        else this.save(image);

    }

    update(image) {

        if (!this.has(image.name))
            throw new Error(`Image "${image.name} not exists."`);

        else this.save(image);

    }

    has(name) {

        let data = this._read();

        if (data.data[name]) return true;
        else return false;

    }

    delete(name) {

        let data = this._read();

        if (!data.data[name])
            throw new Error(`Image "${image.name} not exists."`);

        delete(data.data[name]);

        data.index = [];
        for (let key in data.data) data.index.push(key);

        this._write(data);

    }

    _read() {

        let json = {};

        try {

            let buffer = fs.readFileSync(this._file);
            json = JSON.parse(buffer.toString());

        } catch (error) {

            json = {
                data: {},
                index: [],
            }

        }

        return json;

    }

    _write(data) {

        fs.writeFileSync(this._file, JSON.stringify(data));

    }

}

module.exports = ImageMetaJsonMapper;
