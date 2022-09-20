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
import { jinlunTheme } from './themes/jinlun';

// 主题
const themes = [defaultTheme, fishermanTheme, jinlunTheme];

// 最大关卡
const maxLevel = 50;

interface MySymbol {
    id: string;
    status: number; // 0->1->2
    isCover: boolean;
    x: number;
    y: number;
    icon: Icon;
}

type Scene = MySymbol[];

// 8*8网格  4*4->8*8
const makeScene: (level: number, icons: Icon[]) => Scene = (level, icons) => {
    const curLevel = Math.min(maxLevel, level);
    const iconPool = icons.slice(0, 2 * curLevel);
    const offsetPool = [0, 25, -25, 50, -50].slice(0, 1 + curLevel);

    const scene: Scene = [];

    const range = [
        [2, 6],
        [1, 6],
        [1, 7],
        [0, 7],
        [0, 8],
    ][Math.min(4, curLevel - 1)];

    const randomSet = (icon: Icon) => {
        const offset =
            offsetPool[Math.floor(offsetPool.length * Math.random())];
        const row =
            range[0] + Math.floor((range[1] - range[0]) * Math.random());
        const column =
            range[0] + Math.floor((range[1] - range[0]) * Math.random());
        scene.push({
            isCover: false,
            status: 0,
            icon,
            id: randomString(4),
            x: column * 100 + offset,
            y: row * 100 + offset,
        });
    };

    // 大于5级别增加icon池
    let compareLevel = curLevel;
    while (compareLevel > 0) {
        iconPool.push(
            ...iconPool.slice(0, Math.min(10, 2 * (compareLevel - 5)))
        );
        compareLevel -= 5;
    }

    for (const icon of iconPool) {
        for (let i = 0; i < 6; i++) {
            randomSet(icon);
        }
    }

    return scene;
};

// 洗牌
const washScene: (level: number, scene: Scene) => Scene = (level, scene) => {
    const updateScene = scene.slice().sort(() => Math.random() - 0.5);
    const offsetPool = [0, 25, -25, 50, -50].slice(0, 1 + level);
    const range = [
        [2, 6],
        [1, 6],
        [1, 7],
        [0, 7],
        [0, 8],
    ][Math.min(4, level - 1)];

    const randomSet = (symbol: MySymbol) => {
        const offset =
            offsetPool[Math.floor(offsetPool.length * Math.random())];
        const row =
            range[0] + Math.floor((range[1] - range[0]) * Math.random());
        const column =
            range[0] + Math.floor((range[1] - range[0]) * Math.random());
        symbol.x = column * 100 + offset;
        symbol.y = row * 100 + offset;
        symbol.isCover = false;
    };

    for (const symbol of updateScene) {
        if (symbol.status !== 0) continue;
        randomSet(symbol);
    }

    return updateScene;
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

const App: FC = () => {
    const [curTheme, setCurTheme] = useState<Theme<any>>(defaultTheme);
    const [scene, setScene] = useState<Scene>(makeScene(1, curTheme.icons));
    const [level, setLevel] = useState<number>(1);
    const [queue, setQueue] = useState<MySymbol[]>([]);
    const [sortedQueue, setSortedQueue] = useState<
        Record<MySymbol['id'], number>
    >({});
    const [finished, setFinished] = useState<boolean>(false);
    const [tipText, setTipText] = useState<string>('');
    const [animating, setAnimating] = useState<boolean>(false);

    // 音效
    const soundRefMap = useRef<Record<string, HTMLAudioElement>>({});

    // 第一次点击时播放bgm
    const bgmRef = useRef<HTMLAudioElement>(null);
    const [bgmOn, setBgmOn] = useState<boolean>(false);
    const [once, setOnce] = useState<boolean>(false);
    useEffect(() => {
        if (!bgmRef.current) return;
        if (bgmOn) {
            bgmRef.current.volume = 0.0;
            bgmRef.current.play();
        } else {
            bgmRef.current?.pause();
        }
    }, [bgmOn]);

    // 主题切换
    useEffect(() => {
        restart();
    }, [curTheme]);

    // 队列区排序
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

    // 初始化覆盖状态
    useEffect(() => {
        checkCover(scene);
    }, []);

    // 向后检查覆盖
    const checkCover = (scene: Scene) => {
        const updateScene = scene.slice();
        for (let i = 0; i < updateScene.length; i++) {
            // 当前item对角坐标
            const cur = updateScene[i];
            cur.isCover = false;
            if (cur.status !== 0) continue;
            const { x: x1, y: y1 } = cur;
            const x2 = x1 + 100,
                y2 = y1 + 100;

            for (let j = i + 1; j < updateScene.length; j++) {
                const compare = updateScene[j];
                if (compare.status !== 0) continue;

                // 两区域有交集视为选中
                // 两区域不重叠情况取反即为交集
                const { x, y } = compare;

                if (!(y + 100 <= y1 || y >= y2 || x + 100 <= x1 || x >= x2)) {
                    cur.isCover = true;
                    break;
                }
            }
        }
        setScene(updateScene);
    };

    // 弹出
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
            checkCover(scene);
        }
    };

    // 撤销
    const undo = () => {
        if (!queue.length) return;
        const updateQueue = queue.slice();
        const symbol = updateQueue.pop();
        if (!symbol) return;
        const find = scene.find((s) => s.id === symbol.id);
        if (find) {
            setQueue(updateQueue);
            find.status = 0;
            checkCover(scene);
        }
    };

    // 洗牌
    const wash = () => {
        checkCover(washScene(level, scene));
    };

    // 加大难度
    const levelUp = () => {
        if (level >= maxLevel) {
            return;
        }
        setFinished(false);
        setLevel(level + 1);
        setQueue([]);
        checkCover(makeScene(level + 1, curTheme.icons));
    fetch('http://127.0.0.1:5000/DI-sheep/', 
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({command: 'reset', argument: level})
      })
      .then(response => response.json())
      .then(response => {
        console.log(response.result);
    });
    };

    // 重开
    const restart = () => {
        setFinished(false);
        setLevel(1);
        setQueue([]);
        checkCover(makeScene(1, curTheme.icons));
    fetch('http://127.0.0.1:5000/DI-sheep/', 
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({command: 'reset', argument: level})
      })
      .then(response => response.json())
      .then(response => {
        console.log(response.result);
    });
    };

    // 点击item
    const clickSymbol = async (idx: number) => {
        if (finished || animating) return;


      fetch('http://127.0.0.1:5000/DI-sheep/', 
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({command: 'step', argument: idx})
      })
      .then(response => response.json())
      .then(response => {
        console.log(response.result);
      });


        if (!once) {
            setBgmOn(true);
            setOnce(true);
        }

        const updateScene = scene.slice();
        const symbol = updateScene[idx];
        if (symbol.isCover || symbol.status !== 0) return;
        symbol.status = 1;

        // 点击音效
        if (soundRefMap.current) {
            console.log(soundRefMap.current, symbol.icon);
            soundRefMap.current[symbol.icon.clickSound].currentTime = 0;
            soundRefMap.current[symbol.icon.clickSound].play();
        }

        let updateQueue = queue.slice();
        updateQueue.push(symbol);

        setQueue(updateQueue);
        checkCover(updateScene);

        setAnimating(true);
        await waitTimeout(150);

        const filterSame = updateQueue.filter((sb) => sb.icon === symbol.icon);

        // 三连了
        if (filterSame.length === 3) {
            updateQueue = updateQueue.filter((sb) => sb.icon !== symbol.icon);
            for (const sb of filterSame) {
                const find = updateScene.find((i) => i.id === sb.id);
                if (find) {
                    find.status = 2;
                    // 三连音效
                    if (soundRefMap.current) {
                        soundRefMap.current[
                            symbol.icon.tripleSound
                        ].currentTime = 0;
                        soundRefMap.current[symbol.icon.tripleSound].play();
                    }
                }
            }
        }

        // 输了
        if (updateQueue.length === 7) {
            setTipText('失败了');
            setFinished(true);
        }

        if (!updateScene.find((s) => s.status !== 2)) {
            // 胜利
            if (level === maxLevel) {
                setTipText('完成挑战');
                setFinished(true);
                return;
            }
            // 升级
            setLevel(level + 1);
            setQueue([]);
            checkCover(makeScene(level + 1, curTheme.icons));
        } else {
            setQueue(updateQueue);
            checkCover(updateScene);
        }

        setAnimating(false);
    };

    return (
        <>
            <h2>有解的羊了个羊(DEMO)</h2>
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
                Level: {level}
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
                <button className="flex-grow" onClick={pop}>
                    弹出
                </button>
                <button className="flex-grow" onClick={undo}>
                    撤销
                </button>
                <button className="flex-grow" onClick={wash}>
                    洗牌
                </button>
                <button className="flex-grow" onClick={levelUp}>
                    下一关
                </button>
                {/*<button onClick={test}>测试</button>*/}
            </div>

            <p>
                <span id="busuanzi_container_site_pv">
                    累计访问：<span id="busuanzi_value_site_pv"></span>次
                </span>
            </p>

            {finished && (
                <div className="modal">
                    <h1>{tipText}</h1>
                    <button onClick={restart}>再来一次</button>
                </div>
            )}

            {/*bgm*/}
            <button className="bgm-button" onClick={() => setBgmOn(!bgmOn)}>
                {bgmOn ? '🔊' : '🔈'}
                <audio ref={bgmRef} loop src="/sound-disco.mp3" />
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
