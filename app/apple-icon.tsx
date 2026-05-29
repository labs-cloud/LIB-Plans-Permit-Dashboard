import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

// Apple touch icon shown when the dashboard is saved to the iOS Home Screen.
// Crops the real Lead It Builders logo art down to the hex + orange-stripe
// mark (same framing the header uses) and centers it on a white tile.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Source logo is 2550×3300. These values mirror the LogoHeader crop window
// (96×104 at img-width 360, offset -30/-2), scaled up ~1.458× so the mark
// fills the icon with comfortable padding.
const CROP = { w: 140, h: 152 };
const IMG = { w: 525, h: 679, left: -44, top: -3 };

export default function AppleIcon() {
  const logo = readFileSync(
    join(process.cwd(), 'public/lib_brand/lead_it_builders_logo.png'),
  );
  const src = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
        }}
      >
        <div
          style={{
            width: CROP.w,
            height: CROP.h,
            position: 'relative',
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            width={IMG.w}
            height={IMG.h}
            src={src}
            alt="Lead It Builders"
            style={{ position: 'absolute', left: IMG.left, top: IMG.top }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
