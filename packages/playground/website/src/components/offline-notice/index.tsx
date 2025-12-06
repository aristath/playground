import { Notice } from '../ui';
import css from './style.module.css';

export function OfflineNotice() {
	return (
		<Notice status="warning" className={css.offlineNotice}>
			Some features may not available because you are offline.
		</Notice>
	);
}
