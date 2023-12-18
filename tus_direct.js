
const tus = require('./index');
const AWS = require('aws-sdk')
const ep = new AWS.Endpoint('s3.ap-southeast-1.wasabisys.com')
const S3Store = require('./lib/stores/S3Store')

const express = require('express')
const app = express()
const port = 1080



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
    bucket: 'testing-zip',
    accessKeyId: '5KA2FKCQBP6Y0D63RXYH',
    secretAccessKey: 'm8cVhDQ8zrq0LzH4ozrhRA8TRYVzjK8GmZgVFRt6',
    region: 'ap-southeast-1',
    partSize: 8 * 1024 * 1024, // each uploaded part will have ~8MB,
    tmpDirPrefix: 'tus-s3-store',
  }))
  bukcetSet.create(req) 
})
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
let cors = require('cors');
app.use(cors());

