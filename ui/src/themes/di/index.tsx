import React from 'react';
import { Theme } from '../interface';
import { DefaultSoundNames, defaultSounds } from '../default';

const imagesUrls = import.meta.glob('./images/*.png', {
    import: 'default',
    eager: true,
});

const dis = Object.entries(imagesUrls).map(([key, value]) => ({
    name: key.slice(9, -4),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    content: <img src={value} alt="" />,
}));

export const diTheme: Theme<DefaultSoundNames> = {
    name: 'di',
    icons: dis.map(({ name, content }) => ({
        name,
        content,
        clickSound: 'button-click',
        tripleSound: 'triple',
    })),
    sounds: defaultSounds,
};
