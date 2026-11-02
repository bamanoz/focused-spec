/**
 * Process immutable distributions in order. Dry runs report exact pending work
 * without calling publication clients; authorized runs verify and skip existing
 * versions and never retry a successful publication.
 * @param {readonly string[]} distributions
 * @param {{dryRun: boolean, exists: (name: string) => Promise<boolean> | boolean, publish: (name: string) => Promise<void> | void, verify: (name: string) => Promise<boolean> | boolean}} options
 */
export async function runDistributionPlan(distributions, options) {
  if (options.dryRun) return { published: [], pending: [...distributions], failed: null, complete: false, dryRun: true }
  const published = []
  for (let index = 0; index < distributions.length; index += 1) {
    const name = distributions[index]
    try {
      if (!await options.exists(name)) await options.publish(name)
      if (!await options.verify(name)) throw new Error('verification did not confirm the requested immutable distribution')
      published.push(name)
    } catch (error) {
      return {
        published,
        pending: distributions.slice(index),
        failed: `${name}: ${error instanceof Error ? error.message : String(error)}`,
        complete: false,
        dryRun: false,
      }
    }
  }
  return { published, pending: [], failed: null, complete: true, dryRun: false }
}
