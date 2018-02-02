'use strict';

const {spawn, spawnSync} = require('child_process');

module.exports = file => {

    return new Promise((res, rej) => {

        let ret = '';
        let child = spawn('sha256', ['-q', file]);

        child.stdout.on('data', data => { ret += data; });

        child.on('exit', _ => { res(ret.trim()); });

    });

};
