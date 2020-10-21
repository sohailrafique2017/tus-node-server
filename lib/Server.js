'use strict'

/**
 * @fileOverview
 * TUS Protocol Server Implementation.
 *
 * @author Ben Stahl <bhstahl@gmail.com>
 */
const http = require('http')
const EventEmitter = require('events')
const AWS = require('aws-sdk')
const ep = new AWS.Endpoint('s3.wasabisys.com')
const DataStore = require('./stores/DataStore')
const S3Store = require('./stores/S3Store')
const HeadHandler = require('./handlers/HeadHandler')
const OptionsHandler = require('./handlers/OptionsHandler')
const PatchHandler = require('./handlers/PatchHandler')
const PostHandler = require('./handlers/PostHandler')
const RequestValidator = require('./validators/RequestValidator')
const EXPOSED_HEADERS = require('./constants').EXPOSED_HEADERS
const REQUEST_METHODS = require('./constants').REQUEST_METHODS
const TUS_RESUMABLE = require('./constants').TUS_RESUMABLE
const ERRORS = require('./constants').ERRORS
const debug = require('debug')
const log = debug('tus-node-server')
const requestLogging = []
const axios = require('axios')
const dotenv = require('dotenv')
dotenv.config()
const EVENTS = require('./constants').EVENTS
const Uid = require('./models/Uid')

class TusServer extends EventEmitter {
  constructor() {
    super()

    // Any handlers assigned to this object with the method as the key
    // will be used to repond to those requests. They get set/re-set
    // when a datastore is assigned to the server.
    this.handlers = {}

    // Remove any event listeners from each handler as they are removed
    // from the server. This must come before adding a 'newListener' listener,
    // to not add a 'removeListener' event listener to all request handlers.
    this.on('removeListener', (event, listener) => {
      this.datastore.removeListener(event, listener)
      REQUEST_METHODS.forEach((method) => {
        this.handlers[method].removeListener(event, listener)
      })
    })

    // As event listeners are added to the server, make sure they are
    // bubbled up from request handlers to fire on the server level.
    this.on('newListener', (event, listener) => {
      this.datastore.on(event, listener)
      REQUEST_METHODS.forEach((method) => {
        this.handlers[method].on(event, listener)
      })
    })
  }

  /**
   * Return the data store
   * @return {DataStore}
   */
  get datastore() {
    return this._datastore
  }

  /**
   * Assign a datastore to this server, and re-set the handlers to use that
   * data store when doing file operations.
   *
   * @param  {DataStore} store Store for uploaded files
   */
  set datastore(store) {
    if (!(store instanceof DataStore)) {
      throw new Error(`${store} is not a DataStore`)
    }

    this._datastore = store

    this.handlers = {
      // GET handlers should be written in the implementations
      // eg.
      //      const server = new tus.Server();
      //      server.get('/', (req, res) => { ... });
      GET: {},

      // These methods are handled under the tus protocol
      HEAD: new HeadHandler(store),
      OPTIONS: new OptionsHandler(store),
      PATCH: new PatchHandler(store),
      POST: new PostHandler(store),
    }
  }

  /**
   * Allow the implementation to handle GET requests, in an
   * express.js style manor.
   *
   * @param  {String}   path     Path for the GET request
   * @param  {Function} callback Request listener
   */
  get(path, callback) {
    // Add this handler callback to the GET method handler list.
    this.handlers.GET[path] = callback
  }

  /**
   * Main server requestListener, invoked on every 'request' event.
   *
   * @param  {object} req http.incomingMessage
   * @param  {object} res http.ServerResponse
   * @return {ServerResponse}
   */
  async handle(req, res) {
    // console.log('********************************************************')
    // console.log('request headers', req.headers)
    console.log('request method', req.method)
    console.log('********************************************************')
    console.log('********************************************************')

    // Enable CORS
    res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADERS)
    if (req.headers.origin) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
    }
    // console.log("******** \n", req.method);
    // if (req.method === "OPTIONS") {
    //   res.writeHead(204, {});
    //   // res.write("Un Authorized Access\n");
    //   return res.end();
    // }
    if (req.method === 'POST') {
      if (!req.headers.authorization) {
        res.writeHead(403, {})
        res.write('Un Authorized Access\n')
        return res.end()
      }

      if (!req.headers.type || req.headers.type !== 'FILE') {
        res.writeHead(403, {})
        res.write(
          'Document type is missing, it should be FILE for file upload\n'
        )
        return res.end()
      }

      if (
        !req.headers.dir_type ||
        (req.headers.dir_type !== 'SUB_DIR' && req.headers.dir_type !== 'ROOT')
      ) {
        res.writeHead(403, {})
        res.write(
          'Dir type is missing, for file upload it should be SUB_DIR Or ROOT\n'
        )
        return res.end()
      }

      if (!req.headers.filename || req.headers.filename === '') {
        res.writeHead(403, {})
        res.write('File name is missing\n')
        return res.end()
      }

      const fileInfo = req.headers.filename.split('.')
      if (!fileInfo[fileInfo.length - 1]) {
        res.writeHead(403, {})
        res.write('File extension is missing\n')
        return res.end()
      }
      if (!req.headers.parent_id || Number.isNaN(+req.headers.parent_id)) {
        res.writeHead(403, {})
        res.write('Parent id required and it should be a number\n')
        return res.end()
      }

      if (req.headers.dir_type === 'ROOT' && +req.headers.parent_id > 0) {
        res.writeHead(403, {})
        res.write('Parent id for root should be 0\n')
        return res.end()
      }

      let response = undefined
      try {
        response = await axios.default.get(process.env.AUTH_URL, {
          headers: {
            authorization: req.headers.authorization,
          },
        })
      } catch (error) {
        //if we get some unexpected resposne from ziptic server
        console.log('error ', error)
        res.writeHead(error.response.data.statusCode, {})
        res.write(`${error.response.data.message}\n`)
        return res.end()
      }

      try {
        const response = await axios.default.post(
          process.env.STORAGE_ALREADY_EXIST,
          {
            name: req.headers.filename,
            parentId: +req.headers.parent_id,
          },
          {
            headers: {
              authorization: req.headers.authorization,
            },
          }
        )
        console.log('response: ', response.data)
        if (response.data.response) {
          res.writeHead(400, {})
          res.write(`Storage already exsit with same name in this directory\n`)
          return res.end()
        }
      } catch (error) {
        //if we get some unexpected resposne from ziptic server
        console.log(error)
        res.writeHead(500, {})
        res.write('Some thing went wrong\n')
        return res.end()
      }

      if (req.headers.dir_type !== 'ROOT') {
        try {
          const response = await axios.default.post(
            process.env.VALIDATE_PARENT_ID,
            {
              parent_id: +req.headers.parent_id,
            },
            {
              headers: {
                authorization: req.headers.authorization,
              },
            }
          )
          console.log('response: ', response.data)
          if (!response.data.response.id) {
            res.writeHead(400, {})
            res.write(`Parent Id is not valid for this user\n`)
            return res.end()
          }
          // if(response.data)
        } catch (error) {
          //if we get some unexpected resposne from ziptic server
          console.log(error)
          res.writeHead(500, {})
          res.write('Some thing went wrong\n')
          return res.end()
        }
      }

      if (response && response.data) {
        req.bucket_name = 'bucket-' + response.data.id
        req.partSize = response.data.partSize
      }
      console.log(req.bucket_name)
    } else {
      if (req.method !== 'OPTIONS') {
        let response = undefined
        try {
          response = await axios.default.get(process.env.AUTH_URL, {
            headers: {
              authorization: req.headers.authorization,
              datauploading: true,
            },
          })
        } catch (error) {
          //if we get some unexpected resposne from ziptic server
          console.log(error)
          res.writeHead(error.response.data.statusCode, {})
          res.write(`${error.response.data.message}\n`)
          return res.end()
        }
        if (response && response.data) {
          req.bucket_name = 'bucket-' + response.data.id
          req.partSize = response.data.partSize
        }
        console.log(req.bucket_name)
      }
    }
    log(`[TusServer] handle: ${req.method} ${req.url}`)

    // creating file name

    if (req.method !== 'OPTIONS') {
      if (!req.fileNameOnBucket) {
        let fileNameOnBucket = ''
        const fileNameInfo = req.headers.filename.split('.')
        for (let i = 0; i < fileNameInfo.length - 1; i++) {
          fileNameInfo[i] = fileNameInfo[i].split('#').join('_')
          fileNameOnBucket += fileNameInfo[i].split(' ').join('_') + '_'
        }

        fileNameOnBucket +=
          req.headers.parent_id + '.' + fileNameInfo[fileNameInfo.length - 1]
        req['fileNameOnBucket'] = fileNameOnBucket
      }

      if (requestLogging.length > 0) {
        const bucketInstance = requestLogging.find((item) => {
          return item.id === req.bucket_name
        })

        if (bucketInstance) {
          this.datastore = new S3Store({
            path: '/',
            endpoint: ep,
            bucket: bucketInstance.bucket_name,
            accessKeyId: process.env.ACCESS_KEY_ID,
            secretAccessKey: process.env.SECRET_ACCESS_KEY,
            region: process.env.REGION,
            partSize: +process.env.PART_SIZE, // each uploaded part will have ~8MB,
            tmpDirPrefix: 'tus-s3-store',
          })
        } else
          requestLogging.push({
            id: req.bucket_name,
            bucket_name: req.bucket_name,
          })
        this.datastore = new S3Store({
          path: '/',
          endpoint: ep,
          bucket: req.bucket_name,
          accessKeyId: process.env.ACCESS_KEY_ID,
          secretAccessKey: process.env.SECRET_ACCESS_KEY,
          region: process.env.REGION,
          partSize: +process.env.PART_SIZE, // each uploaded part will have ~8MB,
          tmpDirPrefix: 'tus-s3-store',
        })
      } else {
        requestLogging.push({
          id: req.bucket_name,
          bucket_name: req.bucket_name,
        })
        this._datastore.bucket_name = req.bucket_name
      }
    }
    // Allow overriding the HTTP method. The reason for this is
    // that some libraries/environments to not support PATCH and
    // DELETE requests, e.g. Flash in a browser and parts of Java
    if (req.headers['x-http-method-override']) {
      req.method = req.headers['x-http-method-override'].toUpperCase()
    }

    if (req.method === 'GET') {
      // Check if this url has been added to allow GET requests, with an
      // appropriate callback to handle the request
      if (!(req.url in this.handlers.GET)) {
        res.writeHead(404, {})
        res.write('Not found\n')
        return res.end()
      }

      // invoke the callback
      return this.handlers.GET[req.url](req, res)
    }

    // The Tus-Resumable header MUST be included in every request and
    // response except for OPTIONS requests. The value MUST be the version
    // of the protocol used by the Client or the Server.
    res.setHeader('Tus-Resumable', TUS_RESUMABLE)
    if (
      req.method !== 'OPTIONS' &&
      req.headers['tus-resumable'] === undefined
    ) {
      res.writeHead(412, {}, 'Precondition Failed')
      return res.end('Tus-Resumable Required\n')
    }

    // Validate all required headers to adhere to the tus protocol
    const invalid_headers = []
    for (const header_name in req.headers) {
      if (
        req.method === 'OPTIONS' ||
        req.method === 'POST' ||
        req.method === 'PATCH' ||
        req.method === 'HEAD'
      ) {
        continue
      }

      // Content type is only checked for PATCH requests. For all other
      // request methods it will be ignored and treated as no content type
      // was set because some HTTP clients may enforce a default value for
      // this header.
      // See https://github.com/tus/tus-node-server/pull/116
      if (
        header_name.toLowerCase() === 'content-type' &&
        req.method !== 'PATCH'
      ) {
        continue
      }
      if (
        RequestValidator.isInvalidHeader(header_name, req.headers[header_name])
      ) {
        log(`Invalid ${header_name} header: ${req.headers[header_name]}`)
        invalid_headers.push(header_name)
      }
    }

    if (invalid_headers.length > 0) {
      // The request was not configured to the tus protocol
      res.writeHead(412, {}, 'Precondition Failed')
      return res.end(`Invalid ${invalid_headers.join(' ')}\n`)
    }

    // Invoke the handler for the method requested
    if (this.handlers[req.method]) {
      // console.log("bucket name ", req.bucket_name);

      return this.handlers[req.method].send(req, res)
    } else {
      console.log('req methond not found')
    }

    // 404 Anything else
    res.writeHead(404, {})
    res.write('Not found\n')
    return res.end()
  }

  listen() {
    const server = http.createServer(this.handle.bind(this))
    return server.listen.apply(server, arguments)
  }
}

module.exports = TusServer
