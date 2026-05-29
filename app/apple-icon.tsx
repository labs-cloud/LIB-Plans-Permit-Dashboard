import { ImageResponse } from 'next/og';

// Apple touch icon shown when the dashboard is saved to the iOS Home Screen.
// Uses the Lead It Builders hex mark (matching app/icon.svg) centered on white.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" width="132" height="132" viewBox="0 0 64 64">' +
  '<rect x="29" y="3" width="6" height="26" fill="#F47832"/>' +
  '<polygon points="32,12 52,22 52,46 32,56 12,46 12,22" fill="#000000"/>' +
  '</svg>';

export default function AppleIcon() {
  const markSrc = `data:image/svg+xml;base64,${Buffer.from(MARK).toString('base64')}`;
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={132} height={132} src={markSrc} alt="Lead It Builders" />
      </div>
    ),
    { ...size },
  );
}
