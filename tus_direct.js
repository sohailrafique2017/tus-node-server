
const tus = require('./index');
const AWS = require('aws-sdk')
const ep = new AWS.Endpoint('s3.wasabisys.com')
const S3Store = require('./lib/stores/S3Store')

const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => {
  res.send('Hello World!')
})
app.post('/post', (req,res)=>{
  console.log('requst came in')
  const bukcetSet = new tus.S3Store()
  console.log('bukcetSet ', bukcetSet)
  bukcetSet._setDataSourceForAWSS3(
    ({
    path: '/',
    endpoint: ep,
    bucket: 'userdata',
    accessKeyId: 'N84PSPGUVR6ZPOSZERZ5',
    secretAccessKey: 'q46DOWhF2zeI4SqRh4RHlZF0NBOmzve6yeQPn46n',
    region: 'us-east-1',
    partSize: 8 * 1024 * 1024, // each uploaded part will have ~8MB,
    tmpDirPrefix: 'tus-s3-store',
  }))
  bukcetSet.create(req) 
})
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

