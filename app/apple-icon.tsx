import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

// Apple touch icon shown when the dashboard is saved to the iOS Home Screen.
// Crops the real Lead It Builders logo art down to the hex + orange-stripe
// mark (same framing the header uses) and centers it on a white tile.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Source logo is 2550×3300 and contains the hex mark (x≈366–789, y≈211–706)
// PLUS the "LEAD IT BUILDERS" wordmark starting at x≈886. We crop a 590px
// square centred on the mark (x 282–872, y 163–753) — which stops well short
// of the wordmark — and scale it into a 152px box centred on the white tile.
const CROP = { w: 152, h: 152 };
const IMG = { w: 657, h: 850, left: -73, top: -42 };

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
