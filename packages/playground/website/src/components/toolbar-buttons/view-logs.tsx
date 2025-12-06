import { MenuItem, details } from '../ui';

import { useDispatch } from 'react-redux';
import type { PlaygroundDispatch } from '../../lib/state/redux/store';
import { modalSlugs, setActiveModal } from '../../lib/state/redux/slice-ui';

type Props = { onClose: () => void };
export function ViewLogs({ onClose }: Props) {
	const dispatch: PlaygroundDispatch = useDispatch();
	return (
		<MenuItem
			icon={details}
			iconPosition="left"
			data-cy="view-logs"
			aria-label="View logs"
			onClick={() => {
				dispatch(setActiveModal(modalSlugs.LOG));
				onClose();
			}}
		>
			View logs
		</MenuItem>
	);
}
