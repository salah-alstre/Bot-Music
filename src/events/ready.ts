import { Events } from 'discord.js';
import type { App } from '../app.js';
import { deployCommandsIfChanged } from '../services/commandDeployer.js';
import { PresenceService } from '../services/presence.js';
import { logger } from '../utils/logger.js';

/**
 * Runs once the gateway session is ready. Lavalink is initialised here (it needs the bot user id),
 * and failures are logged rather than fatal: the node client keeps retrying in the background.
 */
export function registerReady(app: App): PresenceService {
  const presence = new PresenceService(app.client, app.lavalink);

  app.client.once(Events.ClientReady, async (client) => {
    logger.info({ user: client.user.tag, guilds: client.guilds.cache.size }, 'Discord connected');

    try {
      await app.lavalink.init({ id: client.user.id, username: client.user.username });
    } catch (error) {
      logger.error({ err: error }, 'Lavalink initialisation failed; the client will keep retrying');
    }

    app.panel.start();
    presence.start();
    await app.panel.restoreControllers();

    try {
      await deployCommandsIfChanged(app.env, app.db);
    } catch (error) {
      logger.error({ err: error }, 'Could not register slash commands. Run "npm run deploy:commands" to retry.');
    }
  });

  return presence;
}
