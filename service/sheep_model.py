import torch
import torch.nn as nn
from ding.torch_utils import Transformer, MLP


class SheepModel(nn.Module):
    mode = ['compute_actor', 'compute_critic', 'compute_actor_critic']

    def __init__(self, item_obs_size=60, bucket_obs_size=30, global_obs_size=17, hidden_size=64, activation=nn.ReLU()):
        super(SheepModel, self).__init__()
        self.item_encoder = Transformer(
            item_obs_size, hidden_dim=2 * hidden_size, output_dim=hidden_size, activation=activation
        )
        self.bucket_encoder = MLP(bucket_obs_size, hidden_size, hidden_size, layer_num=3, activation=activation)
        self.global_encoder = MLP(global_obs_size, hidden_size, hidden_size, layer_num=2, activation=activation)
        self.value_head = nn.Sequential(
            MLP(hidden_size, hidden_size, hidden_size, layer_num=2, activation=activation), nn.Linear(hidden_size, 1)
        )

    def compute_actor(self, x):
        item_embedding = self.item_encoder(x['item_obs'])
        bucket_embedding = self.bucket_encoder(x['bucket_obs'])
        global_embedding = self.global_encoder(x['global_obs'])

        key = item_embedding
        query = bucket_embedding + global_embedding
        query = query.unsqueeze(1)
        logit = (key * query).sum(2)
        logit.masked_fill_(~x['action_mask'].bool(), value=-1e9)
        return {'logit': logit}

    def compute_critic(self, x):
        item_embedding = self.item_encoder(x['item_obs'])
        bucket_embedding = self.bucket_encoder(x['bucket_obs'])
        global_embedding = self.global_encoder(x['global_obs'])

        embedding = item_embedding.mean(1) + bucket_embedding + global_embedding
        value = self.value_head(embedding)
        return {'value': value.squeeze(1)}

    def compute_actor_critic(self, x):
        item_embedding = self.item_encoder(x['item_obs'])
        bucket_embedding = self.bucket_encoder(x['bucket_obs'])
        global_embedding = self.global_encoder(x['global_obs'])

        key = item_embedding
        query = bucket_embedding + global_embedding
        query = query.unsqueeze(1)
        logit = (key * query).sum(2)
        logit.masked_fill_(~x['action_mask'].bool(), value=-1e9)

        embedding = item_embedding.mean(1) + bucket_embedding + global_embedding
        value = self.value_head(embedding)
        return {'logit': logit, 'value': value.squeeze(1)}

    def forward(self, x, mode):
        assert mode in self.mode, "not support forward mode: {}/{}".format(mode, self.mode)
        return getattr(self, mode)(x)
