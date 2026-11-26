// S13 Editor: caller-name overlay for s08 (shots.json s08 assembly_note).
// Writes a full-frame 1440x2560 transparent PNG with the name centred on the
// blank pale band under the contact photo. Used as the top layer of s08 (depth 1,
// move hold), so it stays registered with the frame.
//   swift content/proof/flat2d/make_caller_overlay.swift "बड़े साहब" frames/s08-name.hi.png
// CoreText shapes Devanagari correctly (Pillow is not installed and has no raqm).
// Band measured on frames/s08.png: x 495-944, y 1383-1487 (pixel scan).
import AppKit

let args = CommandLine.arguments
guard args.count == 3 else { print("usage: name out.png"); exit(2) }
let name = args[1], out = args[2]
let W = 1440, H = 2560
let band = CGRect(x: 495, y: 1383, width: 449, height: 104)  // top-left origin

guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: W, pixelsHigh: H,
                                 bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                                 colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else { exit(1) }
rep.size = NSSize(width: W, height: H)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSColor.clear.set()
NSRect(x: 0, y: 0, width: W, height: H).fill()

let ink = NSColor(srgbRed: 0x1B / 255.0, green: 0x24 / 255.0, blue: 0x40 / 255.0, alpha: 1)
var size: CGFloat = 64
var str: NSAttributedString
func make(_ s: CGFloat) -> NSAttributedString {
    let font = NSFont(name: "KohinoorDevanagari-Semibold", size: s) ?? NSFont.boldSystemFont(ofSize: s)
    return NSAttributedString(string: name, attributes: [.font: font, .foregroundColor: ink])
}
str = make(size)
while str.size().width > band.width - 48 && size > 20 { size -= 2; str = make(size) }
let sz = str.size()
// AppKit origin is bottom-left
let cx = band.midX, cyTop = band.midY
let x = cx - sz.width / 2
let y = CGFloat(H) - cyTop - sz.height / 2
str.draw(at: NSPoint(x: x, y: y))
NSGraphicsContext.restoreGraphicsState()
guard let png = rep.representation(using: .png, properties: [:]) else { exit(1) }
try! png.write(to: URL(fileURLWithPath: out))
print("\(out): font \(size) pt, text \(Int(sz.width))x\(Int(sz.height)) at \(Int(x)),\(Int(cyTop - sz.height / 2))")
