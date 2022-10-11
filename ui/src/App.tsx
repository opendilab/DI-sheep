import React, {
    FC,
    MouseEventHandler,
    useEffect,
    useRef,
    useState,
} from 'react';

import './App.css';
import { GithubIcon } from './GithubIcon';
import { randomString, waitTimeout } from './utils';
import { defaultTheme } from './themes/default';
import { Icon, Theme } from './themes/interface';
import { fishermanTheme } from './themes/fisherman';
import { diTheme } from './themes/di';
import { mhlTheme } from './themes/mhl';
import { yhdTheme } from './themes/yhd';

const themes = [defaultTheme, fishermanTheme, diTheme, mhlTheme, yhdTheme];

const maxLevel = 10;
const target_url = 'http://127.0.0.1:5000/DI-sheep/';
// const target_url = 'https://opendilab.net/DI-sheep';

interface MySymbol {
    id: string;
    status: number; // 0->1->2
    isCover: boolean;
    x: number;
    y: number;
    icon: Icon;
}
interface PythonSymbol {
    uid: string;
    accessible: boolean;
    visible: boolean;
    x: number;
    y: number;
    icon: number;
}

type Scene = MySymbol[];

// 8*8 grid with factor 4 (32x32)
const makeScene: (level: number, icons: Icon[], new_scene_data: string[]) => Scene = (level, icons, new_scene_data) => {
    const curLevel = Math.min(maxLevel, level);
    const iconPool = icons.slice(0, 2 * curLevel);

    const scene: Scene = [];

    for (const raw_data of new_scene_data) {
        const data = JSON.parse(raw_data);

        scene.push({
            isCover: !data.accessible,
            // isCover: !data.visible,  // for viz debug
            status: 0,
            icon: iconPool[data.icon],
            id: data.uid,
            x: data.x,
            y: data.y,
        });
    }
    return scene;
};


interface SymbolProps extends MySymbol {
    onClick: MouseEventHandler;
}

const Symbol: FC<SymbolProps> = ({ x, y, icon, isCover, status, onClick }) => {
    return (
        <div
            className="symbol"
            style={{
                transform: `translateX(${x}%) translateY(${y}%)`,
                backgroundColor: isCover ? '#999' : 'white',
                opacity: status < 2 ? 1 : 0,
            }}
            onClick={onClick}
        >
            <div
                className="symbol-inner"
                style={{ opacity: isCover ? 0.5 : 1 }}
            >
                {typeof icon.content === 'string' ? (
                    <i>{icon.content}</i>
                ) : (
                    icon.content
                )}
            </div>
        </div>
    );
};

const uidApp = 'uid' + crypto.randomUUID();
const App: FC = () => {
    const [curTheme, setCurTheme] = useState<Theme<any>>(diTheme);
    const [level, setLevel] = useState<number>(1);
    const [maxItemNum, setMaxItemNum] = useState<number>(0);
    const [resItemNum, setResItemNum] = useState<number>(0);
    
    const [startTime, setStartTime] = useState<number>(0);
    const [now, setNow] = useState<number>(0);
    const [usedTime, setUsedTime] = useState<number>(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    
    const [queue, setQueue] = useState<MySymbol[]>([]);
    const [sortedQueue, setSortedQueue] = useState<
        Record<MySymbol['id'], number>
    >({});
    const [finished, setFinished] = useState<boolean>(false);
    const [tipText, setTipText] = useState<string>('');
    const [animating, setAnimating] = useState<boolean>(false);
    const [expired, setExpired] = useState<boolean>(false);
    const [scene, setScene] = useState<Scene>(makeScene(level, curTheme.icons, []));  // placeholder

    // audio
    const soundRefMap = useRef<Record<string, HTMLAudioElement>>({});

    const bgmRef = useRef<HTMLAudioElement>(null);
    const [bgmOn, setBgmOn] = useState<boolean>(false);
    const [once, setOnce] = useState<boolean>(false);
    useEffect(() => {
        if (!bgmRef.current) return;
        if (bgmOn) {
            bgmRef.current.volume = 0.5;
            bgmRef.current.play();
        } else {
            bgmRef.current?.pause();
        }
    }, [bgmOn]);

    // change themes
    useEffect(() => {
        restart(level);
    }, [curTheme]);

    useEffect(() => {
        if (startTime && now) setUsedTime(now - startTime);
    }, [now]);
    const startTimer = (restart?: boolean) => {
        setStartTime(Date.now() - 0);
        setNow(Date.now());
        intervalRef.current && clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setNow(Date.now());
        }, 10);
    };

    // sort queue
    useEffect(() => {
        const cache: Record<string, MySymbol[]> = {};
        for (const symbol of queue) {
            if (cache[symbol.icon.name]) {
                cache[symbol.icon.name].push(symbol);
            } else {
                cache[symbol.icon.name] = [symbol];
            }
        }
        const temp = [];
        for (const symbols of Object.values(cache)) {
            temp.push(...symbols);
        }
        const updateSortedQueue: typeof sortedQueue = {};
        let x = 50;
        for (const symbol of temp) {
            updateSortedQueue[symbol.id] = x;
            x += 100;
        }
        setSortedQueue(updateSortedQueue);
    }, [queue]);

    const update = (new_scene_data: string[]) => {
        for (const raw_data of new_scene_data) {
            const data = JSON.parse(raw_data);
            const find = scene.find((s) => s.id === data.uid);
            if (find) {
                if (find.status === 0) {
                    find.isCover = !data.accessible;
                }
            }
        }
    };

    // TODO
    const pop = () => {
        if (!queue.length) return;
        const updateQueue = queue.slice();
        const symbol = updateQueue.shift();
        if (!symbol) return;
        const find = scene.find((s) => s.id === symbol.id);
        if (find) {
            setQueue(updateQueue);
            find.status = 0;
            find.x = 100 * Math.floor(8 * Math.random());
            find.y = 700;
        }
    };

    const levelUp = () => {
        if (level >= maxLevel) {
            return;
        }
        setFinished(false);
        setLevel(level + 1);
        setQueue([]);
        fetch(target_url,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify({command: 'reset', argument: level + 1, uid: uidApp})
          })
          .then(response => response.json())
          .then(response => {
            setScene(makeScene(level + 1, curTheme.icons, response.result.scene));
            setMaxItemNum(response.result.max_item_num);
            setResItemNum(response.result.max_item_num);
            setUsedTime(0);
            startTimer(true);
        });
    };

    const restart = (level: number) => {
        setFinished(false);
        setExpired(false);
        setQueue([]);
        fetch(target_url,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify({command: 'reset', argument: level, uid: uidApp})
          })
          .then(response => response.json())
          .then(response => {
            setScene(makeScene(level, curTheme.icons, response.result.scene));
            setMaxItemNum(response.result.max_item_num);
            setResItemNum(response.result.max_item_num);
            setUsedTime(0);
            startTimer(true);
        });
    };

    const clickSymbol = async (idx: number) => {
        // console.time("process");
        if (finished || animating) return;

        if (!once) {
            setBgmOn(true);
            setOnce(true);
            startTimer();
        }

        const updateScene = scene.slice();
        const symbol = updateScene[idx];
        if (symbol.isCover || symbol.status !== 0) return;
        symbol.status = 1;

        if (soundRefMap.current) {
            soundRefMap.current[symbol.icon.clickSound].currentTime = 0;
            soundRefMap.current[symbol.icon.clickSound].play();
        }

        fetch(target_url,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify({command: 'step', argument: idx, uid: uidApp})
          })
          .then(response => response.json())
          .then(response => {
            setFinished(response.statusCode === 501)
            if (response.statusCode != 501) {
                update(response.result.scene);
                setResItemNum(resItemNum - 1);
            }
            setExpired(response.statusCode === 501);
        });

        let updateQueue = queue.slice();
        updateQueue.push(symbol);

        setQueue(updateQueue);

        setAnimating(true);
        // console.timeEnd("process");
        await waitTimeout(150);

        const filterSame = updateQueue.filter((sb) => sb.icon === symbol.icon);

        if (filterSame.length === 3) {
            updateQueue = updateQueue.filter((sb) => sb.icon !== symbol.icon);
            for (const sb of filterSame) {
                const find = updateScene.find((i) => i.id === sb.id);
                if (find) {
                    find.status = 2;
                    if (soundRefMap.current) {
                        soundRefMap.current[
                            symbol.icon.tripleSound
                        ].currentTime = 0;
                        soundRefMap.current[symbol.icon.tripleSound].play();
                    }
                }
            }
        }

        if (updateQueue.length === 7) {
            setTipText('挑战失败');
            setFinished(true);
        }

        if (!updateScene.find((s) => s.status !== 2)) {
            if (level === maxLevel) {
                setTipText('挑战成功');
                setFinished(true);
                return;
            }
            setLevel(level + 1);
            setQueue([]);
            restart(level + 1);
        } else {
            setQueue(updateQueue);
        }

        setAnimating(false);
    };

    return (
        <>
            <h2>DI-sheep: 深度强化学习 + 羊了个羊 </h2>
            <h6>
                <GithubIcon />
            </h6>
            <h3 className="flex-container flex-center">
                主题:
                <select
                    onChange={(e) =>
                        setCurTheme(themes[Number(e.target.value)])
                    }
                >
                    {themes.map((t, idx) => (
                        <option key={t.name} value={idx}>
                            {t.name}
                        </option>
                    ))}
                </select>
            </h3>
            <h3 className="flex-container flex-center">
                关卡: {level}/{maxLevel}    用时: {(usedTime / 1000).toFixed(2)}秒    
                总牌数: {maxItemNum}   剩余牌数: {resItemNum}
            </h3>

            <div className="app">
                <div className="scene-container">
                    <div className="scene-inner">
                        {scene.map((item, idx) => (
                            <Symbol
                                key={item.id}
                                {...item}
                                x={
                                    item.status === 0
                                        ? item.x
                                        : item.status === 1
                                        ? sortedQueue[item.id]
                                        : -1000
                                }
                                y={item.status === 0 ? item.y : 895}
                                onClick={() => clickSymbol(idx)}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div className="queue-container flex-container flex-center" />
            <div className="flex-container flex-between">
                <button className="flex-grow" onClick={() => restart(level)}>
                    重开本关
                </button>
                <button className="flex-grow" onClick={levelUp}>
                    下一关
                </button>
                {/*<button onClick={test}>测试</button>*/}
            </div>

            {finished && (
                <div className="modal">
                    <h1>{tipText}</h1>
                    <button onClick={() => restart(level)}> {expired ? '60s游戏过期，重来一局' : '再来一局'} </button>
                </div>
            )}

            {/*bgm*/}
            <button className="bgm-button" onClick={() => setBgmOn(!bgmOn)}>
                {bgmOn ? '🔊' : '🔈'}
                <audio ref={bgmRef} loop src="/song_of_kedaya.mp3" />
            </button>

            {/*音效*/}
            {curTheme.sounds.map((sound) => (
                <audio
                    key={sound.name}
                    ref={(ref) => {
                        if (ref) soundRefMap.current[sound.name] = ref;
                    }}
                    src={sound.src}
                />
            ))}
        </>
    );
};

export default App;
