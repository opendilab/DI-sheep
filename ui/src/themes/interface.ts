import { ReactNode } from 'react';

export interface Icon<T = string> {
    name: string;
    content: ReactNode;
    clickSound: T;
    tripleSound: T;
}

interface Sound<T = string> {
    name: T;
    src: string;
}

export interface Theme<SoundNames> {
    name: string;
    icons: Icon<SoundNames>[];
    sounds: Sound<SoundNames>[];
}
