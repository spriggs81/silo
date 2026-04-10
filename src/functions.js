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


/*
*  File that handles all  the custom functions that the app uses
*
*/
// local dependencies
import { mkdir, readdir, rename, stat } from 'node:fs/promises'
import path from 'node:path'

// local settings
import { _config } from './settings.js'

// a function that verifies a string that isn't empty
export const isString = (data) => {
    return typeof(data) === 'string' && data.trim().length > 0
}

// a function that verifies a number that is zero or greater
export const isNumber = (data) => {
    return typeof(data) === 'number' && data >= 0
}

// a function that verifies an object
export const isObject = (data) => {
    return data !== null && Array.isArray(data) === false && typeof(data) === 'object'
}

// object that handles the ANSI Terminal Colors
export const colors = {
    'txt': {
        // normal color codes
        'black': '30',
        'red': '31',
        'green': '32',
        'yellow': '33',
        'blue': '34',
        'magenta': '35',
        'cyan': '36',
        'white': '37',
        // high intensity colors (bright colors)
        'bright_black': '90',
        'bright_red': '91',
        'bright_green': '92',
        'bright_yellow': '93',
        'bright_blue': '94',
        'bright_magenta': '95',
        'bright_cyan': '96',
        'bright_white': '97'
    },
    'bg': {
        // normal color codes
        'black': '40',
        'red': '41',
        'green': '42',
        'yellow': '43',
        'blue': '44',
        'magenta': '45',
        'cyan': '46',
        'white': '47',
        // high intensity colors (bright colors)
        'bright_black': '100',
        'bright_red': '101',
        'bright_green': '102',
        'bright_yellow': '103',
        'bright_blue': '104',
        'bright_magenta': '105',
        'bright_cyan': '106',
        'bright_white': '107'
    },
    'reset': '\x1b[00m'
}

// a function that checks a variable and returns it for a string
export const checkVariable = (data) => {
    if(typeof(data) === 'string'){
        const checked = '"' + data + '"'
        return checked
    } else if(typeof(data) === 'number' || typeof(data) === 'boolean' || data === null || data === undefined){
        return data
    } else if(isObject(data)){
        let checked = '{'
        const keys = Object.keys(data)
        for(let i = 0; i < keys.length; i++){
            checked += '"' + keys[i] + '":'
            checked += checkVariable(data[keys[i]])
            if(i + 1 !== keys.length){
                checked += ','
            }
        }
        checked += '}'
        return checked
    } else if(Array.isArray(data)){
        let checked = '['
        for(let i = 0; i < data.length; i++){
            checked += checkVariable(data[i])
            if(i + 1 !== data.length){
                checked += ','
            }
        }
        checked += ']'
        return checked
    } else {
        console.error(`The function used to check variables was unable to check a variable and didn't pass the data in the logs`)
    }
}

// a function that verifies log format and returns a string
export const verifyAndFormatLog = (data) => {
    let str = '"message":'
    if(data instanceof Error){
        if(!data.message && !data.stack && !data.code){
            str += '"Received an Error, but no data was provided in this error object!"'
            return str
        }
        str += '{'
        if(data.message) str += '"error_message":' + checkVariable(data.message) + ','
        if(data.stack) str += '"error_stack":' + checkVariable(data.stack) + ','
        if(data.code) str += '"error_code":' + checkVariable(data.code) 
        str += '}'
        return str
    } else if(isObject(data)){
        str += '{'
        const keys = Object.keys(data)
        for(let i = 0; i < keys.length; i++){
            str += '"' + keys[i] + '":'
            str += checkVariable(data[keys[i]])
            if(i + 1 !== keys.length){
                str += ','
            }
        }
        str += '}'
        return str
    } else if(Array.isArray(data)){
        str += '['
        for(let i = 0; i < data.length; i++){
            str += checkVariable(data[i])
            if(i + 1 !== data.length){
                str += ','
            }
        }
        str += ']'
        return str
    } else if(typeof(data) === 'string' || typeof(data) === 'number' || typeof(data) === 'boolean' || data === null || data === undefined){
        str += checkVariable(data)
        return str
    } else {
        str += '[Error: Unable to format log as the type of log is not supported please check terminal]'
        console.error(`[Error Formating Log]: type: ${typeof(data)}\nLog Received: `, data)
        return str
    }
    
}

// function used to create a dirctory
export const createDir = async () => {
    try {
        mkdir(_config.baseDir,{recursive: true})
    } catch (error) {
        throw new Error(`[Fatal Error creating Directory (${_config.baseDir})]: ${error.message}`)
    }
}

// function used to index files addding '_000' to the filename
export const indexFile = async (filename) => {
    // grab all the files in the directory
    const files  = await readdir(_config.baseDir)

    // update the filename to remove file ext.
    const checkFilename = filename.replace('.log', '')

    // filter only the files that match our file to index
    const matches = files.filter(name => name.startsWith(checkFilename))

    // count all the files that match
    const count = matches.length

    // get the paths ready to index the file
    const currentFilePath = path.join(_config.baseDir, filename)
    const newFilePath = path.join(_config.baseDir, checkFilename + '_' + String(count).padStart(3, '0') + '.log')

    // try to rename file and handle any errors
    try {
        await rename(currentFilePath, newFilePath)
    } catch (error) {
        console.error(`[Error Indexing the file(${filename})]: ${error.message}`)
    }
}

// function that checks the file size and returns a number or null
export const checkTheFileSize = async (filename) => {
    try {
        const fileInfo = await stat(path.join(_config.baseDir, filename))
        return fileInfo.size
    } catch (error) {
        if(error.code === 'ENOENT') {
            return null
        }
        console.error(`[Error Checking File Size (${filename})]: ${error.message}`)
    }
}

const padded = Array.from({length: 100},(_,i) => i.toString().padStart(2,'0'))

const paddedMs = Array.from({length: 1000},(_,i) => i.toString().padStart(3,'0'))

// function that returns the date
export const getDate = () => {
    const d = new Date()
    return  d.getFullYear().toString() + '-' +
            padded[d.getMonth() + 1] + '-' +
            padded[d.getDate()]
}

// function that returns the time
export const getTimeStamp = () => {
    const d = new Date()
    return  d.getFullYear().toString() + '-' +
            padded[d.getMonth() + 1] + '-'+
            padded[d.getDate()] + 'T'+
            padded[d.getHours()] + ':' +
            padded[d.getMinutes()] + ':' +
            padded[d.getSeconds()] + '.' +
            paddedMs[d.getMilliseconds()]
}

// function checks for unsafe filenames
export const isFilenameSafe = (format) => {
    const unsafePattern = /[\\/:\*?"<>|.]/g;
    return !unsafePattern.test(format);
}

