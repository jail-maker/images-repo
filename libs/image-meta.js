'use strict';

class ImageMeta {

    constructor() {

        this.name = '';
        this.version = '';
        this.maintainer = '';

    }

    static fromJSON(data) {

        return Object.assign(new this, data);

    }

}

module.exports = ImageMeta;
