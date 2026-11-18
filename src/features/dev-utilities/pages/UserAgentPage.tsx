import { Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { parseUserAgent } from '@/core/useragent/userAgent';
import { MonoTextField } from '../components/MonoTextField';
import { ResultTable } from '../components/ResultRow';
import { UtilityPage } from '../components/UtilityPage';

const EXAMPLES: [string, string][] = [
  [
    'Chrome / Windows',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  ],
  [
    'Safari / iPhone',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  ],
  ['Firefox / Linux', 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'],
  [
    'Samsung / Android',
    'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  ],
  ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['curl', 'curl/8.5.0'],
];

interface UADataLike {
  brands?: { brand: string; version: string }[];
  mobile?: boolean;
  platform?: string;
}

export default function UserAgentPage() {
  const [ua, setUa] = useState(() => navigator.userAgent);
  const parsed = parseUserAgent(ua);
  const hints = (navigator as { userAgentData?: UADataLike }).userAgentData;
  const val = (...parts: (string | null)[]) => parts.filter(Boolean).join(' ') || '—';
  return (
    <UtilityPage toolId="utils.user-agent">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={1.5}>
          <MonoTextField
            label="User-Agent string"
            value={ua}
            onChange={(e) => {
              setUa(e.target.value);
            }}
            minRows={2}
          />
          <Stack
            direction="row"
            spacing={0.75}
            useFlexGap
            sx={{ flexWrap: 'wrap', alignItems: 'center' }}
          >
            <Button
              size="small"
              onClick={() => {
                setUa(navigator.userAgent);
              }}
            >
              Use my browser
            </Button>
            {EXAMPLES.map(([label, value]) => (
              <Chip
                key={label}
                size="small"
                variant="outlined"
                label={label}
                onClick={() => {
                  setUa(value);
                }}
              />
            ))}
          </Stack>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="h5" component="p" sx={{ mb: 1 }} aria-label="Summary">
          {parsed.summary}
        </Typography>
        <ResultTable
          ariaLabel="Parsed user agent"
          items={[
            { label: 'Browser', value: val(parsed.browser.name, parsed.browser.version) },
            { label: 'Rendering engine', value: val(parsed.engine.name, parsed.engine.version) },
            { label: 'Operating system', value: val(parsed.os.name, parsed.os.version) },
            { label: 'Device type', value: parsed.device.type },
            { label: 'Device', value: val(parsed.device.vendor, parsed.device.model) },
            { label: 'CPU architecture', value: parsed.cpu ?? '—' },
            ...(parsed.bot ? [{ label: 'Bot / tool', value: parsed.bot }] : []),
          ]}
        />
      </Paper>
      {hints && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="subtitle2" component="h2">
            Your browser&apos;s Client Hints
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
            Newer browsers freeze parts of the User-Agent string; Client Hints are the reliable
            source.
          </Typography>
          <ResultTable
            ariaLabel="Client hints"
            items={[
              {
                label: 'Brands',
                value: (hints.brands ?? []).map((b) => `${b.brand} ${b.version}`).join(', ') || '—',
              },
              { label: 'Platform', value: hints.platform ?? '—' },
              { label: 'Mobile', value: hints.mobile ? 'yes' : 'no' },
            ]}
          />
        </Paper>
      )}
    </UtilityPage>
  );
}
