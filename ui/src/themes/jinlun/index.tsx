import { Theme } from '../interface';
import React from 'react';

const soundUrls = import.meta.glob('./sounds/*.mp3', {
    import: 'default',
    eager: true,
});

const sounds = Object.entries(soundUrls).map(([key, value]) => ({
    name: key.slice(9, -4),
    src: value,
})) as Theme<string>['sounds'];

const imagesUrls = import.meta.glob('./images/*.png', {
    import: 'default',
    eager: true,
});

const icons = Object.entries(imagesUrls).map(([key, value]) => ({
    name: key.slice(9, -4),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    content: <img src={value} alt="" />,
}));

export const jinlunTheme: Theme<string> = {
    name: '金轮',
    icons: icons.map(({ name, content }) => ({
        name,
        content,
        clickSound: name,
        tripleSound: '起飞啦',
    })),
    sounds,
};
