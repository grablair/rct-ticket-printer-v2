// QR Code generation utility with rounded corners and dots
import QRCodeStyling, { DotType } from "qr-code-styling"
import { JSDOM } from 'jsdom'
import nodeCanvas = require('canvas')
import FileReader from 'typescript'

export interface QRCodeOptions {
  data: string
  width: number
  height: number
  dotsOptions?: {
    color: string
    type?: DotType
  }
  cornersSquareOptions?: {
    color: string
    type?: DotType
  }
  backgroundOptions?: {
    color: string
  }
}

export async function generateQRCode(options: QRCodeOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create a QR code with styling
      const qrCode = new QRCodeStyling({
        jsdom: JSDOM,
        nodeCanvas,
        width: options.width,
        height: options.height,
        type: "svg",
        data: options.data,
        image: undefined,
        dotsOptions: {
          color: options.dotsOptions?.color || "#000000",
          type: options.dotsOptions?.type || "rounded",
        },
        cornersSquareOptions: {
          color: options.cornersSquareOptions?.color || "#000000",
          type: options.cornersSquareOptions?.type || "extra-rounded",
        },
        backgroundOptions: {
          color: options.backgroundOptions?.color || "#FFFFFF",
        },
      })

      qrCode.getRawData().then((value) => {
        return resolve(`data:image/svg+xml;base64,${value != null ? value.toString('base64') : ""}`);
      })
    } catch (error) {
      reject(error)
    }
  })
}