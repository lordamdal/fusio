#!/usr/bin/env python3
"""Generate placeholder icon files for Tauri build."""
import struct, zlib, os

ICON_DIR = os.path.join(os.path.dirname(__file__), '..', 'src-tauri', 'icons')
os.makedirs(ICON_DIR, exist_ok=True)

def make_png(w, h):
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    raw = b''
    for y in range(h):
        raw += b'\x00'
        for x in range(w):
            raw += struct.pack('BBB', 0x22, 0xd3, 0xee)
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

with open(os.path.join(ICON_DIR, '32x32.png'), 'wb') as f: f.write(make_png(32, 32))
with open(os.path.join(ICON_DIR, '128x128.png'), 'wb') as f: f.write(make_png(128, 128))
with open(os.path.join(ICON_DIR, '128x128@2x.png'), 'wb') as f: f.write(make_png(256, 256))
with open(os.path.join(ICON_DIR, 'tray-icon.png'), 'wb') as f: f.write(make_png(32, 32))

png32 = make_png(32, 32)
with open(os.path.join(ICON_DIR, 'icon.ico'), 'wb') as f:
    f.write(struct.pack('<HHH', 0, 1, 1))
    f.write(struct.pack('<BBBBHHIH', 32, 32, 0, 0, 1, 32, len(png32), 22))
    f.write(png32)

png128 = make_png(128, 128)
with open(os.path.join(ICON_DIR, 'icon.icns'), 'wb') as f:
    icon_type = b'ic07'
    entry = icon_type + struct.pack('>I', len(png128) + 8) + png128
    f.write(b'icns' + struct.pack('>I', len(entry) + 8) + entry)

print('Icons created successfully in', ICON_DIR)
