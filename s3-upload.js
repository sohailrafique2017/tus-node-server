var path = require('path');
var async = require('async');
var fs = require('fs');
var AWS = require('aws-sdk'); 
const ep = new AWS.Endpoint('s3.wasabisys.com')
// AWS.config.loadFromPath('./aws.json');

var s3 = new AWS.S3(); 
// var bucketName = "YOUR BUCKET NAME";

function uploadMultipart(absoluteFilePath, fileName, uploadCb) {
  s3.createMultipartUpload({ Bucket: bucketName, Key: fileName }, (mpErr, multipart) => {
    if(!mpErr){
      //console.log("multipart created", multipart.UploadId);
      fs.readFile(absoluteFilePath, (err, fileData) => {

        var partSize = 1024 * 1024 * 5;
        var parts = Math.ceil(fileData.length / partSize);

        async.timesSeries(parts, (partNum, next) => {

          var rangeStart = partNum*partSize;
          var end = Math.min(rangeStart + partSize, fileData.length);

          console.log("uploading ", fileName, " % ", (partNum/parts).toFixed(2));

          partNum++;  
          async.retry((retryCb) => {
            s3.uploadPart({
              Body: fileData.slice(rangeStart, end),
              Bucket: bucketName,
              Key: fileName,
              PartNumber: partNum,
              UploadId: multipart.UploadId
            }, (err, mData) => {
              retryCb(err, mData);
            });
          }, (err, data)  => {
            //console.log(data);
            next(err, {ETag: data.ETag, PartNumber: partNum});
          });

        }, (err, dataPacks) => {
          s3.completeMultipartUpload({
            Bucket: bucketName,
            Key: fileName,
            MultipartUpload: {
              Parts: dataPacks
            },
            UploadId: multipart.UploadId
          }, uploadCb);
        });
      });
    }else{
      uploadCb(mpErr);
    }
  });
}

function uploadFile(absoluteFilePath, uploadCb) {
  const bucketName = 'userdata'
  s3 = new AWS.S3({
    endpoint: ep,
    bucket: 'userdata',
    accessKeyId: 'N84PSPGUVR6ZPOSZERZ5',
    secretAccessKey: 'q46DOWhF2zeI4SqRh4RHlZF0NBOmzve6yeQPn46n',
    region: 'us-east-1',
})
  var fileName = path.basename(absoluteFilePath);
  var stats = fs.statSync(absoluteFilePath)
  var fileSizeInBytes = stats["size"]

  if(fileSizeInBytes < (1024*1024*5)) {
    async.retry((retryCb) => {
      fs.readFile(absoluteFilePath, (err, fileData) => {
        s3.putObject({
          Bucket: bucketName, 
          Key: fileName, 
          Body: fileData
        }, retryCb);        
      });
    }, uploadCb);
  }else{
    uploadMultipart(absoluteFilePath, fileName, uploadCb)
  }
}

uploadFile('./README.md', ()=>{
  console.log(' I am done uploading')
})