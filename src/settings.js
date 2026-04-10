/**
 * Copyright 2026 John Spriggs (Flowrdesk LLC)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// local dependencies
import path from "node:path"
import os from "node:os"

// local functions
import { isString, isNumber, isFilenameSafe } from "./functions.js"

export const _config = {
    baseDir: path.join(process.cwd(), '.logs'),
    maxBufferSize: 256, //kb
}

const appSetting = {
    setDir: dir => {
        if(!isString(dir)) throw new Error(`JS-Log-Manager support strings for the directory update`)

        if(!isFilenameSafe(dir)) {
            const prohibited = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '.'];
            throw new Error(`Directory name is unsafe or contains prohibited characters. The following are NOT allowed: ${prohibited.join(' ')}`);
        } else {
            _config.baseDir = path.join(process.cwd(), dir)
            return _config
        }
    },

    setBufferSize: (num) => {
        if(!isNumber(num) || num <= 0) throw new Error(`The Buffer Size(KB) must be a number that is greater than zero!`)

        _config.maxBufferSize = num
        return _config
    }
}

export const bufferAutoTune = () => {

        const   budget = 64,
                balanced = 128,
                extreme = 256

    const model = os.cpus()[0].model

    // 1. Check for high-end "Extreme" chips
    const isExtreme = /[iR][79]-/.test(model) || /Max|Ultra|Threadripper|EPYC/i.test(model);
    
    // 2. Check for mid-range "Balanced" chips
    const isBalanced = /[iR]5-/.test(model) || /Apple M[1-3](?! (Max|Ultra))/.test(model);

    if(isExtreme) {
        _config.maxBufferSize = extreme
        console.log(`JS-Log-Manager has set your write buffer to 256kb (Extreme Mode)!`)
    } else if(isBalanced) {
        _config.maxBufferSize = balanced
        console.log(`JS-Log-Manager has set your write buffer to 128kb (Balance Mode)!`)
    } else {
        _config.maxBufferSize = budget
        console.log(`JS-Log-Manager has set your write buffer to 64kb (Budget Mode)!`)
    }
    return _config;
}

export const configuration = obj => {
    for(const key in obj) {
        if(key in appSetting) {
            appSetting[key](obj[key])
        }
    }
}