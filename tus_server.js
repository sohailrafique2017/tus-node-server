const tus = require('./index')
const AWS = require('aws-sdk')
const EVENTS = require('./index').EVENTS
const ep = new AWS.Endpoint('s3.wasabisys.com')
const server = new tus.Server()
server.datastore = new tus.S3Store({
  path: '/',
  endpoint: ep,
  bucket: 'userdata',
  accessKeyId: 'N84PSPGUVR6ZPOSZERZ5',
  secretAccessKey: 'q46DOWhF2zeI4SqRh4RHlZF0NBOmzve6yeQPn46n',
  region: 'us-east-1',
  partSize: 8 * 1024 * 1024, // each uploaded part will have ~8MB,
  tmpDirPrefix: 'tus-s3-store',
})

const host = '192.168.1.29'
const port = 1080
server.listen({ host, port }, () => {
  console.log(
    `[${new Date().toLocaleTimeString()}] tus server listening at http://${host}:${port}`
  )
})
