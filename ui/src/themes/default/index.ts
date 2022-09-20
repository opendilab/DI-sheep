import { Theme } from '../interface';

const icons = <const>[
    `🎨`,
    `🌈`,
    `⚙️`,
    `💻`,
    `📚`,
    `🐯`,
    `🐤`,
    `🐼`,
    `🐏`,
    `🍀`,
];

export type DefaultSoundNames = 'button-click' | 'triple';

import soundButtonClickUrl from './sounds/sound-button-click.mp3';
import soundTripleUrl from './sounds/sound-triple.mp3';
export const defaultSounds: Theme<DefaultSoundNames>['sounds'] = [
    {
        name: 'button-click',
        src: soundButtonClickUrl,
    },
    {
        name: 'triple',
        src: soundTripleUrl,
    },
];

export const defaultTheme: Theme<DefaultSoundNames> = {
    name: '默认',
    icons: icons.map((icon) => ({
        name: icon,
        content: icon,
        clickSound: 'button-click',
        tripleSound: 'triple',
    })),
    sounds: defaultSounds,
};
