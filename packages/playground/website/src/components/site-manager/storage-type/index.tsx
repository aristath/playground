import { Icon, folder, layout } from '../../ui';
import { ClockIcon } from '@wp-playground/components';
import css from './style.module.css';
import type { SiteStorageType } from '../../../lib/state/redux/slice-sites';

export function StorageType({ type }: { type: SiteStorageType }) {
	switch (type) {
		case 'local-fs':
			return (
				<div className={css.storageType}>
					<Icon size={16} icon={folder} />
					<span>Local</span>
				</div>
			);
		case 'opfs':
			return (
				<div className={css.storageType}>
					<Icon size={16} icon={layout} />
					<span>Browser</span>
				</div>
			);
		case 'none':
			return (
				<div className={css.storageType}>
					<ClockIcon />
					<span>Temporary</span>
				</div>
			);
	}
}
