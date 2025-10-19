import { createCanvas, loadImage, CanvasRenderingContext2D, registerFont } from 'canvas';
import { generateQRCode } from "./lib/qr-code.ts";
import express,{ Request, Response } from "express";
import { Image } from 'canvas'
import { createWriteStream } from 'fs'
import { promises as fs } from "fs"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"
import { getPrinterConfig } from "./lib/ticket-printer.ts"

const execPromise = promisify(exec)

export interface TicketData {
  show: string
  dateTime: string
  name: string
  ticketType?: string 
  isSubscriber: boolean
  section: string
  row: string
  seat: string
  ticketId: string
}

export interface TicketRequestBody {
  tickets: TicketData[]
}

// Helper to get show abbreviation for title images
export function getShowAbbreviation(showName: string): string {
  // Simple implementation - convert to lowercase and remove spaces
  // You might want to implement a more sophisticated mapping based on your needs
  return showName.toLowerCase().replace(/\s+/g, "-").replaceAll(/[!\?,':\.]/g, "")
}

// Font loader utility to register custom fonts
export function loadCustomFonts() {
  try {
    // Register all the custom fonts
    const fontWeights = ["350", "400", "500", "550", "600", "700"]

    fontWeights.forEach(weight => {
      registerFont(`fonts/adjusted-${weight}.ttf`, { family: 'HankenGrotesk', weight: weight })
    });

    return true
  } catch (error) {
    console.error("Error loading custom fonts:", error)
    return false
  }
}

loadCustomFonts();

const app = express();
const port = 3000;

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send(`
    <p>
    Welcome to the RCT web-based ticket printer. Send tickets via a POST call to this URL in the following format:
    </p>
    <pre>
      {
        "show": "My Show",
        "dateTime": "Thursday, Octember 32 - 7:30PM,
        "name": "Joe Schmoe",
        "ticketType": "Standard Admission,
        "isSubscriber": false,
        "section": "CTR",
        "row": "A",
        "seat": "5",
        "ticketId": "1234567890"
      }
    </pre>
  `);
});

app.post("/", async (req: Request, res: Response) => {
  console.log(req.body);
  const tickets: TicketData[] = req.body.tickets;

  await tickets.forEach(async ticket => {
    const canvas = createCanvas(1650, 600)
    const ctx = canvas.getContext('2d')

    // Set canvas dimensions - adjust as needed for the template
    canvas.width = 1650 // Increased canvas size to accommodate QR code
    canvas.height = 600 // Increased height based on coordinates

    // Load template image
    await loadImage('img/rct-ticket-template.png').then(async (templateImage: Image) => {
      // Clear canvas
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw template image as background
      ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height)

      // Load show title image
      const showAbbrev = getShowAbbreviation(ticket.show)

      // Fallback to text title
      ctx.fillStyle = "#000000"
      ctx.font = "500 70px HankenGrotesk"
      ctx.textAlign = "left"

      const titleText = ticket.show
      let maxWidth = 700
      let fontSize = 70
      let textMetrics = ctx.measureText(titleText)
      let textWidth = textMetrics.width

      // Reduce font size if text is too wide
      while (textWidth > maxWidth && fontSize > 50) {
        fontSize -= 2
        ctx.font = `500 ${fontSize}px HankenGrotesk`
        textMetrics = ctx.measureText(titleText)
        textWidth = textMetrics.width
      }

      let textHeight = Math.abs(textMetrics.actualBoundingBoxAscent) + Math.abs(textMetrics.actualBoundingBoxDescent);
      ctx.fillText(ticket.show, 38, 20 + fontSize, 700)

      // default to set y offset for text show names
      const dateY = 20 + fontSize + 10 + 32;

      await loadImage(`img/logos/${showAbbrev}.png`).then(async (logoImage: Image) => {
        let w, h;
        if (logoImage.height > logoImage.width) {
          h = 600 - 60;
          w = logoImage.width * (h / logoImage.height);
        } else {
          w = 600 - 60;
          h = logoImage.height * (w / logoImage.width);
        }

        let x = 1032 - w/2;
        let y = 600 / 2 - h/2;

        ctx.drawImage(logoImage, x, y, w, h);
      });

      // Draw date with specified styling
      ctx.fillStyle = "#000000"
      ctx.font = "500 32px HankenGrotesk"
      ctx.textAlign = "left"

      // Handle text wrapping if needed
      const dateText = ticket.dateTime
      maxWidth = 700
      fontSize = 32
      textWidth = ctx.measureText(dateText).width

      // Reduce font size if text is too wide
      while (textWidth > maxWidth && fontSize > 12) {
        fontSize -= 2
        ctx.font = `500 ${fontSize}px HankenGrotesk`
        textWidth = ctx.measureText(dateText).width
      }

      ctx.fillText(dateText, 38, dateY, maxWidth)
      let contactAndLocationText = "Renton Civic Theatre\n507 S Third St, Renton, WA 98507\nboxoffice@rentoncivictheatre.org | (425) 226-5529";

      ctx.font = `350 26px HankenGrotesk`;

      textMetrics = ctx.measureText(contactAndLocationText)
      textHeight = Math.abs(textMetrics.actualBoundingBoxAscent) + Math.abs(textMetrics.actualBoundingBoxDescent);

      ctx.fillText(contactAndLocationText, 38, 268 - textHeight + 10, 700);

      // Draw attendee name
      ctx.fillStyle = "#FFFFFF" // White text
      ctx.font = "600 42px HankenGrotesk"
      ctx.textAlign = "center"

      // Handle text wrapping for name
      const nameText = ticket.name
      const nameMaxWidth = 570
      let nameFontSize = 42
      let nameTextWidth = ctx.measureText(nameText).width

      // Reduce font size if name is too wide
      while (nameTextWidth > nameMaxWidth && nameFontSize > 16) {
        nameFontSize -= 2
        ctx.font = `600 ${nameFontSize}px HankenGrotesk`
        nameTextWidth = ctx.measureText(nameText).width
      }

      ctx.fillText(nameText, 372 - 19, 307 + 25, nameMaxWidth)

      // Draw section
      ctx.fillStyle = "#000000" // Black text
      ctx.font = "500 70px HankenGrotesk"
      ctx.textAlign = "center"
      ctx.fillText(ticket.section, 187 - 19, 490 + 25)

      // Draw row
      ctx.fillText(ticket.row, 402 - 19, 490 + 25)

      // Draw seat
      ctx.fillText(ticket.seat, 589 - 19, 490 + 25)

      // Special note for subscribers with GA section
      if (ticket.isSubscriber && ticket.section === "GA") {
        ctx.fillStyle = "#000000"
        ctx.font = "500 25px HankenGrotesk"
        ctx.textAlign = "left"
        ctx.fillText("See board member for seat preference selection", 59, 562)
      }

      // Draw white circle for subscribers
      if (ticket.isSubscriber) {
        ctx.beginPath()
        ctx.arc(663, 267, 10, 0, 2 * Math.PI) // Center at (663, 267) with radius 10
        ctx.fillStyle = "#FFFFFF"
        ctx.fill()
        ctx.strokeStyle = "#000000"
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.fillStyle = "#000000"
        ctx.font = "350 25px HankenGrotesk"
        ctx.textAlign = "center"
        ctx.fillText("Thank you for being a subscriber!", 372 - 19, 570 + 18)
      }

      // Draw QR code
      const qrDataUrl = await generateQRCode({
        data: ticket.ticketId,
        width: 180,
        height: 180,
        dotsOptions: {
          color: "#000000",
          type: "rounded",
        },
        cornersSquareOptions: {
          color: "#000000",
          type: "extra-rounded",
        },
      });

      loadImage(qrDataUrl).then(async (qrImage: Image) => {
        const outputFilepath = `./img/generated-tickets/${ticket.ticketId}.png`;
        ctx.drawImage(qrImage, 1650 - 40 - 180, 600 - 40 - 180, 180, 180)

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(1650-40-180-20, 600-40-180/2)
        ctx.rotate(-90 * Math.PI / 180);
        ctx.font = "350 37px HankenGrotesk"
        ctx.fillText(ticket.ticketId, 0, 0, 170)

        const out = createWriteStream(outputFilepath);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on('finish', async () => {
          console.log(`Ticket generated to ${outputFilepath}... Sending to printer.`);
          await directPrint(outputFilepath);
        });
      });
    }).catch((err: Error) => {
      res.send("Error");
      console.log(err);
    });
  });

  res.send("OK")
});

app.listen(port, () => {
  console.log(`Ticket printer server listening on ${port}`);
});

export async function directPrint(filePath: string) {
  // Get printer configuration
  const printerConfig = getPrinterConfig()

  // Print the image using the system's default printer or a specified printer
  let printCommand

  if (process.platform === "win32") {
    // Windows printing - BOCA printers typically come with Windows drivers
    printCommand = `"${printerConfig.windowsPrintUtility}" -printer "${printerConfig.printerName}" -dpi ${printerConfig.dpi} -papersize "${printerConfig.width}x${printerConfig.height}" "${filePath}"`
  } else {
    // Linux/Mac printing using lp
    // BOCA printers on Linux/Mac typically work with CUPS
    printCommand = `lp -d "${printerConfig.printerName}" -o media="BOCA ${printerConfig.width}x${printerConfig.height}in" -o resolution=${printerConfig.dpi} "${filePath}"`
  }

  console.log("Executing print command:", printCommand)

  // Execute the print command
  const { stdout, stderr } = await execPromise(printCommand)

  if (stderr && !stderr.includes("requesting printer")) {
    console.error("Error printing:", stderr)
  }

  // Clean up the temporary file
  try {
    await fs.unlink(filePath)
  } catch (error) {
    console.error("Error deleting temporary file:", error)
  }
}