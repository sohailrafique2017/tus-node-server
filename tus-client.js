const tus = require('tus-js-client')
var fs = require('fs')
var path = './LICENSE'
var file = fs.createReadStream(path)
var size = fs.statSync(path).size
var options = {
    endpoint: 'http://localhost:3000/post',
    metadata: {
        filename: 'LICENECEFILE',
    },
    uploadSize: size,
    onError: function (error) {
        throw error
    },
    onProgress: function (bytesUploaded, bytesTotal) {
        var percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2)
        console.log(bytesUploaded, bytesTotal, percentage + '%')
    },
    onSuccess: function () {
        console.log('Upload finished:', upload.url)
    },
}
var upload = new tus.Upload(file, options)
upload.start()