'use strict';

class ImageMeta {

    constructor() {

        this.name = '';
        this.version = '';
        this.maintainer = '';
        this.description = '';
        this.parent = null;

        this.fileName = '';
        this.sha256 = '';

    }

    static fromJSON(data) {

        return Object.assign(new this, data);

    }

}

module.exports = ImageMeta;
