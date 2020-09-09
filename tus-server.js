const Server = require('./index').Server
const S3Store = require('./index').S3Store
const EVENTS = require('./lib/constants').EVENTS
const AWS = require('aws-sdk')
const server = new Server()
const path = require('path')
const ep = new AWS.Endpoint('s3.wasabisys.com')

server.datastore = new S3Store({
    path: '/files',
    endpoint: ep,
    bucket: 'userdata',
    accessKeyId: 'N84PSPGUVR6ZPOSZERZ5',
    secretAccessKey: 'q46DOWhF2zeI4SqRh4RHlZF0NBOmzve6yeQPn46n',
    region: 'us-east-1',
    partSize: 8 * 1024 * 1024, // each uploaded part will have ~8MB,
    tmpDirPrefix: 'tus-s3-store',
})

server.on(EVENTS.EVENT_UPLOAD_COMPLETE, (event) => {
    console.log(`Upload complete for file ${event.file.id}`)
})

const express = require('express')
const app = express()
const uploadApp = express()
uploadApp.all('*', server.handle.bind(server))
app.use('/uploads', uploadApp)
const host = 'localhost'
const port = 1080
app.listen(port, host, () => {
    console.log(
        `[${new Date().toLocaleTimeString()}] tus server listening at http://${host}:${port}`
    )
})
