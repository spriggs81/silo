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
*  File that handles everything related to the logging part of our app
*
*/
// local dependencies
import os from 'node:os'
import path from 'node:path'
import { createWriteStream } from 'node:fs'

// local settings
import { _config } from './settings.js'

// local functions
import { isString, isNumber, colors, verifyAndFormatLog, createDir, indexFile, checkTheFileSize, getTimeStamp, getDate} from './functions.js'

export default class Logs {
    constructor({filename, level = null, maxSize = 250, txtColor, bgColor, benchmark = false, toFile = true, toTerminal = true, terminalRaw = false, maxQueueDepth = 50_000}){
        if(!isString(filename)) throw new Error(`JS-Log_Manager supports 'Strings' for the filename only!`)
        if(level !== null && !isString(level) && !isNumber(level)) throw new Error(`JS-Log_Manager supports 'Strings' or 'Numbers (zero or greater)' for the level only!`)
        if(!isNumber(maxSize) || maxSize <= 0) throw new Error(`JS-Log_Manager supports 'Numbers (greater than zero)' for the maxSize only!`)

        Object.assign(this, { filename, level, benchmark, toFile, toTerminal, terminalRaw })

        this.txtColor = isString(txtColor) && colors.txt.hasOwnProperty(txtColor) ? colors.txt[txtColor] : null
        this.bgColor = isString(bgColor) && colors.bg.hasOwnProperty(bgColor) ? colors.bg[bgColor] : null

        // variables needed to handle the processing of the terminal logs
        this.terminalQueue = []
        this.terminalStream = null
        this.isTerminalDraining = false
        this.terminalProcessing = false

        // variables needed to handle the processing of the raw terminal logs
        this.rawTerminalQueue = []
        this.rawTerminalStream = null
        this.isRawTerminalDraining = false
        this.rawTerminalProcessing = false

        // variables needed to handle the processing of the file logs
        this.doesDirecttoryExist = false
        this.writeStream = null
        this.streamFilename = null
        this.isDraining = false
        this.maxBufferSizeByKB = 1024 * _config.maxBufferSize
        this.fileQueue = []
        this.maxFileSizeByMB = 1024 * 1024 * maxSize
        this.cachedFileSize = 0
        this.isIndexing = false
        this.checkedFileSize = false
        this.endingWriteStream = false
        this.fileProcessing = false
        
        this.maxQueueDepth = maxQueueDepth
        this.drainThreshold = Math.floor(maxQueueDepth * 0.5)
        this.fileQueueWaiters = []
        // ─────────────────────────────────────────────────────

        // variables needed to handle flush (benefit for benchmarking)
        this.flushPromise = null
        this.terminalFlushPromise = null
        this.rawTerminalFlushPromise = null
        this.resolveFlush = null
        this.terminalResolveFlush = null
        this.rawTerminalResolveFlush = null

        // holding metadata
        this.hostname = os.hostname()
        this.pid = process.pid

        // the start up function that handles all the processes needed when the app starts
        this.initStart()
        this.count = 0
    }

    waitForQueueSpace = () => {
        if (this.fileQueue.length < this.maxQueueDepth) {
            return Promise.resolve()
        }
        return new Promise(resolve => {
            this.fileQueueWaiters.push(resolve)
        })
    }
    
    _releaseWaiters = () => {
        if (this.fileQueueWaiters.length === 0) return
        const waiters = this.fileQueueWaiters.splice(0)
        for (const resolve of waiters) resolve()
    }
    // ─────────────────────────────────────────────────────────

    // creates a stream to handle processing the terminal's queue
    startTerminalStream = () => {
        const system = os.platform()

        const streamPath = this.benchmark && system === 'win32' ? 'NUL'
                        : this.benchmark && (system === 'darwin' || system === 'linux') ? '/dev/null'
                        : process.stdout

        const settings = streamPath === '/dev/null' || streamPath === 'NUL'
                        ? {flags: 'w', highWaterMark: this.maxBufferSizeByKB}
                        : {fd: 1, highWaterMark: this.maxBufferSizeByKB}

        this.terminalStream = createWriteStream(streamPath, settings)
        this.processTerminalQue()

        this.terminalStream.on('drain', () => {
            if(this.isTerminalDraining) this.isTerminalDraining = false
            setImmediate(() => {
                this.processTerminalQue()
            })
        })
    }

    // creates a stream to handle processing the raw terminal queue
    startRawTerminalStream = () => {
        const system = os.platform()

        const streamPath = this.benchmark && system === 'win32' ? 'NUL'
                        : this.benchmark && (system === 'darwin' || system === 'linux') ? '/dev/null'
                        : process.stdout

        const settings = streamPath === '/dev/null' || streamPath === 'NUL'
                        ? {flags: 'w', highWaterMark: this.maxBufferSizeByKB}
                        : {fd: 1, highWaterMark: this.maxBufferSizeByKB}

        this.rawTerminalStream = createWriteStream(streamPath, settings)
        this.processRawTerminalQue()

        this.rawTerminalStream.on('drain', () => {
            if(this.isRawTerminalDraining) this.isRawTerminalDraining = false
            setImmediate(() => this.processRawTerminalQue())
        })
    }

    // function to end the Terminal stream
    endTerminalStream = (callback = () => {}) => {
        if(!this.terminalStream) return
        this.terminalStream.end(() => {
            this.terminalStream = null
            callback()
        })
    }

    // function to end the Raw Terminal stream
    endRawTerminalStream = (callback = () => {}) => {
        if(!this.rawTerminalStream) return
        this.rawTerminalStream.end(() => {
            this.rawTerminalStream = null
            callback()
        })
    }

    // function that prints to the terminal with ANSI colors if provided in settings
    terminal = (userLog, manualTime = null) => {
        const timeStamp = manualTime ? manualTime : getTimeStamp()
        const level = this.level ? (typeof(this.level) === 'string' ? `"level":"${this.level}",` : `"level":${this.level},`) : ''
        const metadata = !this.benchmark
                        ? `"logTime":"${timeStamp}","hostname":"${this.hostname}","pid":${this.pid},`
                        : ''
        const verifiedLog = verifyAndFormatLog(userLog)
        const colorCode = []
        if(this.txtColor) colorCode.push(`\x1b[${this.txtColor}m`)
        if(this.bgColor) colorCode.push(`\x1b[${this.bgColor}m`)
        const fullLog = `${colorCode.join('')}{${level}${metadata}${verifiedLog}}${colors.reset}`

        this.terminalQueue.push(fullLog + '\n')
        if(!this.terminalProecssing) {
            this.terminalProecssing = true
            setImmediate(() => {
                this.processTerminalQue()
            })
        }
    }

    // function to process the terminal queue
    processTerminalQue = () => {
        if(this.terminalQueue.length === 0 || this.isTerminalDraining) return
        if(!this.terminalStream){
            this.startTerminalStream()
            return
        }
        while(!this.isTerminalDraining && this.terminalQueue.length > 0){
            const terminalBackPressure = this.terminalStream.write(this.terminalQueue.shift())
            if(!terminalBackPressure) {
                this.isTerminalDraining = true
                return
            }
        }
    }

    // function that prints to the terminal without formatting (mainly used for benchmarking)
    terminal_raw = (userLog, manualTime = null) => {
        this.count++
        const level = this.level ? (typeof(this.level) === 'string' ? `"level":"${this.level}",` : `"level":${this.level},`) : ''
        const time = manualTime ? Date.now(_config.todayDate + manualTime) : Date.now()
        const metadata = !this.benchmark
                        ? `"logTime":"${time}","hostname":"${this.hostname}","pid":${this.pid},`
                        : ''
        const verifiedLog = verifyAndFormatLog(userLog)
        this.rawTerminalQueue.push(`{${level}${metadata}${verifiedLog}}\n`)
        if(!this.rawTerminalProcessing) {
            this.rawTerminalProcessing = true
            setImmediate(() => {
                this.processRawTerminalQue()
            })
        }
    }

    // function to process the raw terminal queue
    processRawTerminalQue = () => {
        if((this.rawTerminalQueue.length === 0 && !this.rawTerminalProcessing) || this.isRawTerminalDraining) return
        if(!this.rawTerminalStream){
            this.startRawTerminalStream()
            return
        }

        const str = []
        const target = this.maxBufferSizeByKB * .75

        while(!this.isRawTerminalDraining && this.rawTerminalQueue.length > 0){
            const grab = this.rawTerminalQueue.length > 5000 ? 5000 : this.rawTerminalQueue.length
            const chucks = this.rawTerminalQueue.splice(0, grab)
            str.push(chucks.join(''))

            if(str.join('').length >= target || (this.rawTerminalQueue.length === 0 && str.join('').length > 0)) {
                const rawTerminalBackPressure = this.rawTerminalStream.write(str.join(''))
                if(!rawTerminalBackPressure) {
                    this.isRawTerminalDraining = true
                    return
                }
                str.length = 0
            }
        }

        if(this.rawTerminalQueue.length > 0 && !this.isRawTerminalDraining) {
            setImmediate(() => this.processRawTerminalQue())
        } else if(this.rawTerminalQueue.length === 0) {
            this.rawTerminalProcessing = false
            if(this.rawTerminalResolveFlush) {
                this.rawTerminalFlush()
            }
        }
    }

    // creates the directory for the file log folder
    _createDir = async () => {
        if(this.doesDirecttoryExist) return
        await createDir()
        this.doesDirecttoryExist = true
    }

    // creates a writable stream and handles draining
    startWriteStream = () => {
        if(this.writeStream || this.endingWriteStream) return

        const fileDate = getDate()
        this.streamFilename = `${this.filename}_${fileDate}.log`
        const filePath = path.join(_config.baseDir, this.streamFilename)

        if(this.isDraining) this.isDraining = false

        this.writeStream = createWriteStream(filePath, {
            highWaterMark: this.maxBufferSizeByKB,
            flags: 'a'
        })

        setImmediate(() => this.processFileQue())

        this.writeStream.on('drain', () => {
            this.isDraining = false
            setImmediate(() => this.processFileQue())
        })
    }

    // function to end the write stream
    endWriteStream = (callback = () => {}) => {
        if(!this.writeStream || this.endingWriteStream) return
        if(!this.endingWriteStream) this.endingWriteStream = true
        this.writeStream.end(() => {
            this.writeStream = null
            if(this.endingWriteStream) this.endingWriteStream = false
            callback()
        })
    }

    file = async (userLog, manualTime = null) => {
        const timeStamp = manualTime ? manualTime : getTimeStamp()
        const level = this.level ? (typeof(this.level) === 'string' ? `"level":"${this.level}",` : `"level":${this.level},`) : ''
        const metadata = !this.benchmark
                        ? `"logTime":"${timeStamp}","hostname":"${this.hostname}","pid":${this.pid},`
                        : ''
        const verifiedLog = verifyAndFormatLog(userLog)

        this.fileQueue.push(`{${level}${metadata}${verifiedLog}}\n`)

        if(this.fileQueue.length >= this.maxQueueDepth){
            await this.waitForQueueSpace()
        }

        if(!this.fileProcessing) {
            this.fileProcessing = true
            setImmediate(() => {
                this.processFileQue()
            })
        }
    }

    processFileQue = () => {
        if(this.fileQueue.length === 0 && !this.fileProcessing) {
            if(this.resolveFlush) this.flush()
            return
        }

        if(!this.writeStream) {
            this.startWriteStream()
            return
        }

        if(this.isDraining || this.isIndexing || !this.doesDirecttoryExist || this.endingWriteStream) return

        const str = []
        const targetSize = this.maxBufferSizeByKB * .80

        while(!this.isDraining && !this.isIndexing && !this.endingWriteStream && this.fileQueue.length > 0) {
            const grab = this.fileQueue.length > 5000 ? 5000 : this.fileQueue.length
            const chunks = this.fileQueue.splice(0, grab)
            str.push(chunks.join(''))

            if(str.join('').length >= targetSize
                || (this.cachedFileSize + str.join('').length) >= this.maxFileSizeByMB
                || (this.fileQueue.length === 0 && str.join('').length > 0)) {

                const noBackPressure = this.writeStream.write(str.join(''))
                this.cachedFileSize += str.join('').length

                if(noBackPressure === false) {
                    this.isDraining = true
                }

                if(this.cachedFileSize >= this.maxFileSizeByMB) {
                    this._indexFile(this.streamFilename)
                }

                str.length = 0
            }

            // ── Release parked callers once queue drains to threshold ──
            if(this.fileQueue.length <= this.drainThreshold) {
                this._releaseWaiters()
            }
            // ──────────────────────────────────────────────────────────
        }

        if(this.fileQueue.length > 0 && !this.isDraining && !this.isIndexing) {
            setImmediate(() => this.processFileQue())
        } else if(this.fileQueue.length === 0) {
            this.fileProcessing = false
            // Release any remaining waiters on full drain
            this._releaseWaiters()
            if(this.resolveFlush) {
                this.flush()
            }
        }
    }

    // The Unified Logging Function
    logg = async (data) => {
        const timeStamp = getTimeStamp()
        
        if (this.toFile) await this.file(data, timeStamp)
            
        if (this.toTerminal) {
            if (this.terminalRaw) {
                this.terminal_raw(data, timeStamp)
            }else {
                this.terminal(data, timeStamp)
            }
        }
    }

    // index the file and add the index to the filename
    _indexFile = (filename) => {
        if(this.isIndexing) return
        this.isIndexing = true
        this.streamFilename = null
        this.endWriteStream(async () => {
            if(this.writeStream === null) {
                try {
                    await indexFile(filename)
                } catch (error) {
                    console.error(`[Error Handling Indexing]: ${error.message}`)
                } finally {
                    this.isIndexing = false
                    this.cachedFileSize = 0
                    if(this.isDraining) this.isDraining = false
                    setImmediate(() => this.startWriteStream())
                }
            }
        })
    }

    // checks the size of the file if it exists and updates the cache
    _checkTheFileSize = async () => {
        if(this.checkedFileSize) return
        const fileDate = getDate()
        const filename = `${this.filename}_${fileDate}.log`
        const size = await checkTheFileSize(filename)
        if(size > 0) this.cachedFileSize = size
        this.checkedFileSize = true
    }

    // function that starts all the upfront processes
    initStart = async () => {
        await this._createDir()
        await this._checkTheFileSize()
    }

    flush = () => {
        if(!this.flushPromise){
            this.flushPromise = new Promise(resolve => {
                this.resolveFlush = resolve
            })
        }
        if(this.fileQueue.length === 0) {
            if(this.writeStream){
                this.endWriteStream(() => {
                    this.resolveFlush()
                    this.flushPromise = null
                    this.resolveFlush = null
                })
            } else {
                this.resolveFlush()
                this.flushPromise = null
                this.resolveFlush = null
            }
        } else {
            if(!this.fileProcessing) {
                this.fileProcessing = true
                setImmediate(() => this.processFileQue())
            }
        }
        return this.flushPromise
    }

    terminalFlush = () => {
        if(!this.terminalFlushPromise) {
            this.terminalFlushPromise = new Promise(resolve => {
                this.terminalResolveFlush = resolve
            })
        }
        if(this.terminalQueue.length === 0) {
            if(this.terminalStream) {
                this.endTerminalStream(() => {
                    this.terminalResolveFlush()
                    this.terminalFlushPromise = null
                    this.terminalResolveFlush = null
                })
            } else {
                this.terminalResolveFlush()
                this.terminalFlushPromise = null
                this.terminalResolveFlush = null
            }
        } else {
            if(!this.terminalProcessing) {
                this.terminalProcessing = true
                setImmediate(() => this.processTerminalQue())
            }
        }
        return this.terminalFlushPromise
    }

    rawTerminalFlush = () => {
        if(!this.rawTerminalFlushPromise) {
            this.rawTerminalFlushPromise = new Promise(resolve => {
                this.rawTerminalResolveFlush = resolve
            })
        }
        if(this.rawTerminalQueue.length === 0) {
            if(this.rawTerminalStream) {
                this.endRawTerminalStream(() => {
                    this.rawTerminalResolveFlush()
                    this.rawTerminalFlushPromise = null
                    this.rawTerminalResolveFlush = null
                })
            } else {
                this.rawTerminalResolveFlush()
                this.rawTerminalFlushPromise = null
                this.rawTerminalResolveFlush = null
            }
        } else {
            if(!this.rawTerminalProcessing) {
                this.rawTerminalProcessing = true
                setImmediate(() => this.processRawTerminalQue())
            }
        }
        return this.rawTerminalFlushPromise
    }
}