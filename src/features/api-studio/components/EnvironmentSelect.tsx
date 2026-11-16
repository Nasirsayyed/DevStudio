import { IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import { Setting4 } from 'iconsax-reactjs';
import { useNavigate } from 'react-router';
import { useActiveEnvironment } from '../hooks';

const NONE = '__none__';

/** Active environment (whose variables resolve {{name}}), with a link to manage them. */
export function EnvironmentSelect() {
  const { environments, active, setActive } = useActiveEnvironment();
  const navigate = useNavigate();
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <TextField
        select
        size="small"
        label="Environment"
        value={active?.id ?? NONE}
        onChange={(e) => {
          setActive(e.target.value === NONE ? null : e.target.value);
        }}
        sx={{ width: 180 }}
      >
        <MenuItem value={NONE}>No environment</MenuItem>
        {(environments ?? []).map((env) => (
          <MenuItem key={env.id} value={env.id}>
            {env.name}
          </MenuItem>
        ))}
      </TextField>
      <Tooltip title="Manage environments">
        <IconButton
          size="small"
          aria-label="Manage environments"
          onClick={() => void navigate('/api/environments')}
        >
          <Setting4 size={18} color="currentColor" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
