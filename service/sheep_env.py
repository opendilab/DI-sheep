from typing import Tuple, Optional, Dict
from collections import deque
import copy
import gym
import uuid
import numpy as np


class Item:

    def __init__(self, icon, offset, row, column):
        self.icon = icon
        self.offset = offset
        self.row = row
        self.column = column
        self.uid = uuid.uuid4()
        self.x = column * 100 + offset
        self.y = row * 100 + offset
        self.grid_x = self.x % 25
        self.grid_y = self.y % 25
        self.accessible = 1
        self.visible = 1

    def __repr__(self) -> str:
        return 'icon({})'.format(self.icon)


class SheepEnv(gym.Env):
    max_level = 5
    icons = [i for i in range(10)]
    R = 10

    def __init__(self, level: int, bucket_length: int = 7) -> None:
        self.level = level
        assert 1 <= self.level <= self.max_level
        self.bucket_length = bucket_length
        self._make_game()
        self._set_space()

    def seed(self, seed: int) -> None:
        self._seed = seed
        np.random.seed(self._seed)

    def _make_game(self) -> None:
        # TODO wash scene
        self.icon_pool = self.icons[:2 * self.level]
        self.offset_pool = [0, 25, -25, 50, -50][:1 + self.level]
        self.range = [
            [2, 6],
            [1, 6],
            [1, 7],
            [0, 7],
            [0, 8],
        ][min(4, self.level - 1)]
        self.total_item_num = 2 * self.level * 6

        self.scene = []
        self.bucket = deque(maxlen=8)

        for i in range(len(self.icon_pool)):
            for j in range(6):
                offset = self.offset_pool[np.int(np.random.random() * len(self.offset_pool))]
                row = self.range[0] + np.int((self.range[1] - self.range[0]) * np.random.random())
                column = self.range[0] + np.int((self.range[1] - self.range[0]) * np.random.random())
                item = Item(self.icon_pool[i], offset, row, column)
                self.scene.append(item)
        self.cur_item_num = len(self.scene)
        self.reward_3tiles = self.R * 0.5 / (len(self.scene) // 3)

        self._update_visible_accessible()

    def _update_visible_accessible(self) -> None:
        for i in range(self.total_item_num):
            covered_items = []
            item1 = self.scene[i]
            if item1 is None:
                continue
            for j in range(i + 1, self.total_item_num):
                item2 = self.scene[j]
                if item2 is None:
                    continue
                if not (item2.x + 100 <= item1.x or item2.x >= item1.x + 100 or item2.y + 100 <= item1.y
                        or item2.x >= item1.x + 100):
                    item1.accessible = 0
                    covered_items.append(item2)
            if len(covered_items) > 0:
                xs = [item.x - item1.x + 100 * int(item1.x < item.x) for item in covered_items]
                flag_x = 0 in xs or len(xs) > len(set(xs))  # repeat xs
                ys = [item.y - item1.y + 100 * int(item1.y < item.y) for item in covered_items]
                flag_y = 0 in ys or len(ys) > len(set(ys))  # repeat ys
                item1.visible = int(flag_x and flag_y)
            else:
                item1.visible = 1

    def _execute_action(self, action: int) -> float:
        action_item = copy.deepcopy(self.scene[action])
        assert action_item is not None, action
        self.scene[action] = None
        self.cur_item_num -= 1
        same_items = []
        for i in range(len(self.bucket)):
            item = self.bucket[i]
            if item.icon == action_item.icon:
                same_items.append(item)

        if len(same_items) == 2:
            for item in same_items:
                self.bucket.remove(item)
            return copy.deepcopy(self.reward_3tiles)  # necessary deepcopy
        else:
            self.bucket.append(action_item)
            return 0.

    def reset(self, level: Optional[int] = None) -> Dict:
        if level is not None:
            self.level = level
            assert 1 <= self.level <= self.max_level
        self._make_game()
        self._set_space()
        return self._get_obs()

    def close(self) -> None:
        pass

    # usually overwritten methods

    def step(self, action: int) -> Tuple:
        rew = self._execute_action(action)
        self._update_visible_accessible()

        obs = self._get_obs()
        if self.cur_item_num == 0:
            rew += self.R
            done = True
        elif len(self.bucket) == self.bucket_length:
            rew -= self.R
            done = True
        else:
            done = False
        info = {}
        return obs, rew, done, info

    def _get_obs(self) -> Dict:
        N = self.range[1] - self.range[0]
        # icon + x + y + accessible + visible
        L = len(self.icons) + 2  # +2 for not visible and move out
        item_size = L + 4 * N * 2 + 2 + 2
        item_obs = np.zeros((self.total_item_num, item_size))
        action_mask = np.zeros(self.total_item_num).astype(np.uint8)

        p1, p2, p3 = L + N, L + N + N, L + N + N + 2
        for i in range(len(self.scene)):
            item = self.scene[i]
            if item is None:
                item_obs[i][L - 1] = 1
            else:
                item_obs[i][L + item.grid_x] = 1
                item_obs[i][p1 + item.grid_y] = 1
                item_obs[i][p3 + item.visible] = 1
                if item.visible:
                    item_obs[i][item.icon] = 1
                    item_obs[i][p2 + item.accessible] = 1
                    action_mask[i] = 1
                else:
                    item_obs[i][L - 2] = 1

        bucket_obs = np.zeros(3 * len(self.icons))
        bucket_icon_stat = [0 for _ in range(len(self.icons))]
        for item in self.bucket:
            bucket_icon_stat[item.icon] += 1
        for i in range(len(bucket_icon_stat)):
            bucket_obs[i * 3 + bucket_icon_stat[i]] = 1

        global_size = self.total_item_num // 6 + self.bucket_length
        global_obs = np.zeros(global_size)
        global_obs[self.cur_item_num // 6] = 1
        global_obs[self.cur_item_num // 6 + len(self.bucket)] = 1

        return {
            'item_obs': item_obs,
            'bucket_obs': bucket_obs,
            'global_obs': global_obs,
            'action_mask': action_mask,
        }

    def _set_space(self) -> None:
        N = self.range[1] - self.range[0]
        L = len(self.icons) + 2
        item_size = L + 4 * N * 2 + 2 + 2
        self.observation_space = gym.spaces.Dict(
            {
                'item_obs': gym.spaces.Box(0, 1, dtype=np.float32, shape=(self.total_item_num, item_size)),
                'bucket_obs': gym.spaces.Box(0, 1, dtype=np.float32, shape=(3 * len(self.icons), )),
                'global_obs': gym.spaces.Box(
                    0, 1, dtype=np.float32, shape=(self.total_item_num // 6 + self.bucket_length, )
                ),
                'action_mask': gym.spaces.Box(0, 1, dtype=np.float32, shape=(self.total_item_num, ))  # TODO
            }
        )
        self.action_space = gym.spaces.Discrete(self.total_item_num)
        self.reward_space = gym.spaces.Box(-self.R * 1.5, self.R * 1.5, dtype=np.float32)
