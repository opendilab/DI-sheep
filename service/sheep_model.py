import torch
import torch.nn as nn
from ding.torch_utils import Transformer, MLP, unsqueeze, to_tensor


class SheepModel(nn.Module):
    mode = ['compute_actor', 'compute_critic', 'compute_actor_critic']

    def __init__(self, item_obs_size=60, item_num=None, bucket_obs_size=30, global_obs_size=17, hidden_size=64, activation=nn.ReLU()):
        super(SheepModel, self).__init__()
        # 1. transformer
        # self.item_encoder = Transformer(
        #     item_obs_size, hidden_dim=2 * hidden_size, output_dim=hidden_size, activation=activation
        # )
        # 2. directly MLP
        # self.item_encoder = MLP(item_obs_size, hidden_size, hidden_size, layer_num=3, activation=activation)
        # 3. two stage MLP
        self.trans_len = 16
        self.item_num = item_num
        self.item_encoder_1 = MLP(item_obs_size, hidden_size, self.trans_len, layer_num=3, activation=activation)
        self.item_encoder_2 = MLP(self.trans_len*item_num, hidden_size, hidden_size, layer_num=2, activation=activation)
        self.fc = nn.Linear(hidden_size, item_num)
        ### end 3
        self.bucket_encoder = MLP(bucket_obs_size, hidden_size, hidden_size, layer_num=3, activation=activation)
        self.global_encoder = MLP(global_obs_size, hidden_size, hidden_size, layer_num=2, activation=activation)
        self.value_head = nn.Sequential(
            MLP(hidden_size, hidden_size, hidden_size, layer_num=2, activation=activation), nn.Linear(hidden_size, 1)
        )

    def compute_actor(self, x):
        # item_embedding = self.item_encoder(x['item_obs'])
        # 3
        item_embedding_1 = self.item_encoder_1(x['item_obs'])   # (B, M, L)
        item_embedding_2 = torch.reshape(item_embedding_1, [-1, self.trans_len*self.item_num])
        item_embedding = self.item_encoder_2(item_embedding_2)
        ### end3
        bucket_embedding = self.bucket_encoder(x['bucket_obs'])
        global_embedding = self.global_encoder(x['global_obs'])

        key = item_embedding
        query = bucket_embedding + global_embedding
        # query = query.unsqueeze(1)
        # logit = (key * query).sum(2)
        logit = self.fc(key * query)    # 3
        logit.masked_fill_(~x['action_mask'].bool(), value=-1e9)
        return {'logit': logit}

    def compute_critic(self, x):
        # item_embedding = self.item_encoder(x['item_obs'])
        # 3
        item_embedding_1 = self.item_encoder_1(x['item_obs'])   # (B, M, L)
        item_embedding_2 = torch.reshape(item_embedding_1, [-1, self.trans_len*self.item_num])
        item_embedding = self.item_encoder_2(item_embedding_2)
        ### end3
        bucket_embedding = self.bucket_encoder(x['bucket_obs'])
        global_embedding = self.global_encoder(x['global_obs'])

        # embedding = item_embedding.mean(1) + bucket_embedding + global_embedding
        embedding = item_embedding + bucket_embedding + global_embedding    # 3
        value = self.value_head(embedding)
        return {'value': value.squeeze(1)}

    def compute_actor_critic(self, x):
        # input x:(batch_size, card_num, fv_size)
        # item_embedding = self.item_encoder(x['item_obs'])       # output: (batch_size, card_num, hidden_size)
        # 3
        item_embedding_1 = self.item_encoder_1(x['item_obs'])   # (B, M, L)
        item_embedding_2 = torch.reshape(item_embedding_1, [-1, self.trans_len*self.item_num])
        item_embedding = self.item_encoder_2(item_embedding_2)
        ### end3
        bucket_embedding = self.bucket_encoder(x['bucket_obs']) # output: (batch_size, hidden_size)
        global_embedding = self.global_encoder(x['global_obs']) # output: (batch_size, hidden_size)

        key = item_embedding
        query = bucket_embedding + global_embedding
        # query = query.unsqueeze(1)  # output: (batch_size, 1, hidden_size)
        # logit = (key * query).sum(2)    # key * query: (batch_size, card_num, hidden_size)
        logit = self.fc(key * query)    # 3
        logit.masked_fill_(~x['action_mask'].bool(), value=-1e9)

        # embedding = item_embedding.mean(1) + bucket_embedding + global_embedding
        embedding = item_embedding + bucket_embedding + global_embedding
        value = self.value_head(embedding)
        return {'logit': logit, 'value': value.squeeze(1)}

    def forward(self, x, mode):
        assert mode in self.mode, "not support forward mode: {}/{}".format(mode, self.mode)
        return getattr(self, mode)(x)

    def compute_action(self, x):
        x = unsqueeze(to_tensor(x))
        with torch.no_grad():
            logit = self.compute_actor(x)['logit']
            return logit.argmax(dim=-1)[0].item()
