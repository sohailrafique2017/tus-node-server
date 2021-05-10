const eccrypto = require("eccrypto");
const base64 = require('base-64')

async function encryptData(data, key) {
	try {
		const encryptedData = await eccrypto.encrypt(Buffer.from(key, 'hex'), JSON.stringify(data))
		return base64.encode(JSON.stringify(encryptedData))

	} catch (error) {
		console.log('Error in encryptData: ', error)
		throw error
	}
}

async function decryptData(data) {
	try {
		data = base64.decode(data)
		data = JSON.parse(data)
		const encryptedBufferedData = {}
		encryptedBufferedData.iv = Buffer.from(data.iv.data)
		encryptedBufferedData.ephemPublicKey = Buffer.from(data.ephemPublicKey.data)
		encryptedBufferedData.ciphertext = Buffer.from(data.ciphertext.data)
		encryptedBufferedData.mac = Buffer.from(data.mac.data)
		const decryptedData = await eccrypto.decrypt(Buffer.from(process.env.DECRYPTION_KEY, 'hex'), encryptedBufferedData)
		return JSON.parse(decryptedData.toString())
	} catch (error) {
		console.log('Error in decryptData: ', error);
		throw error
	}
}

module.exports = {
	encryptData,
	decryptData
}