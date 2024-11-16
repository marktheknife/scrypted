import type { ScryptedRuntime } from "../runtime";
import { matchesClusterLabels } from "../cluster/cluster-labels";
import { ClusterForkOptions, ClusterForkParam, PeerLiveness } from "../scrypted-cluster-main";

export class ClusterFork {
    constructor(public runtime: ScryptedRuntime) { }

    async fork(peerLiveness: PeerLiveness, options: ClusterForkOptions, packageJson: any, zipHash: string, getZip: () => Promise<Buffer>) {
        const matchingWorkers = [...this.runtime.clusterWorkers].map(worker => ({
            worker,
            matches: matchesClusterLabels(options, worker.labels),
        }))
        .filter(({ matches }) => matches);
        matchingWorkers.sort((a, b) => b.worker.labels.length - a.worker.labels.length);
        const worker = matchingWorkers[0]?.worker;

        if (!worker)
            throw new Error(`no worker found for cluster labels ${JSON.stringify(options.labels)}`);

        const fork: ClusterForkParam = await worker.peer.getParam('fork');
        const forkResult = await fork(peerLiveness, options.runtime, packageJson, zipHash, getZip);
        worker.forks.add(options);
        forkResult.waitKilled().catch(() => {}).finally(() => {
            worker.forks.delete(options);
        });
        return forkResult;
    }

    async getClusterWorkers() {
        const ret: any = {};
        for (const worker of this.runtime.clusterWorkers) {
            ret[worker.peer.peerName] = {
                labels: worker.labels,
                forks: [...worker.forks],
            };
        }
        return ret;
    }
}