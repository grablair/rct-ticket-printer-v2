// BOCA printer configuration
interface BocaPrinterConfig {
  printerName: string
  width: number // Width in inches
  height: number // Height in inches
  dpi: number
  windowsPrintUtility: string // Path to Windows print utility if applicable
}

// Default configuration for BOCA printer
const defaultPrinterConfig: BocaPrinterConfig = {
  printerName: "BOCA_SYSTEMS_46_300", // Replace with your actual BOCA printer name
  width: 5.5, // Width in inches
  height: 2, // Height in inches
  dpi: 300, // BOCA printers typically support 300 DPI
  windowsPrintUtility: "C:\\Windows\\System32\\mspaint.exe", // Default to MS Paint, replace with appropriate utility
}

// Get printer configuration, allowing for environment-specific overrides
export function getPrinterConfig(): BocaPrinterConfig {
  return {
    printerName: process.env.PRINTER_NAME || defaultPrinterConfig.printerName,
    width: Number(process.env.TICKET_WIDTH) || defaultPrinterConfig.width,
    height: Number(process.env.TICKET_HEIGHT) || defaultPrinterConfig.height,
    dpi: Number(process.env.PRINTER_DPI) || defaultPrinterConfig.dpi,
    windowsPrintUtility: process.env.WINDOWS_PRINT_UTILITY || defaultPrinterConfig.windowsPrintUtility,
  }
}

// Calculate pixel dimensions based on physical dimensions and DPI
export function calculatePixelDimensions(widthInches: number, heightInches: number, dpi: number) {
  return {
    widthPixels: Math.round(widthInches * dpi),
    heightPixels: Math.round(heightInches * dpi),
  }
}

// Generate appropriate canvas dimensions for ticket creation
export function getCanvasDimensions() {
  const config = getPrinterConfig()
  const { widthPixels, heightPixels } = calculatePixelDimensions(config.width, config.height, config.dpi)

  return {
    width: widthPixels,
    height: heightPixels,
  }
}
