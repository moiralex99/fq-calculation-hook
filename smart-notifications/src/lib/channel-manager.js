/**
 * Channel Manager
 * Gère l'enregistrement et la coordination des canaux de notification
 */

export class ChannelManager {
  constructor(logger) {
    this.logger = logger;
    this.channels = new Map();
  }

  /**
   * Enregistre un canal
   */
  register(name, channelInstance) {
    if (this.channels.has(name)) {
      this.logger?.warn(`[ChannelManager] Channel ${name} already registered, overwriting`);
    }

    this.channels.set(name, channelInstance);
    this.logger?.info(`[ChannelManager] Registered channel: ${name}`);
  }

  /**
   * Récupère un canal
   */
  get(name) {
    const channel = this.channels.get(name);
    
    if (!channel) {
      throw new Error(`Channel ${name} not registered`);
    }

    return channel;
  }

  /**
   * Vérifie si un canal existe
   */
  has(name) {
    return this.channels.has(name);
  }

  /**
   * Liste tous les canaux disponibles
   */
  list() {
    return Array.from(this.channels.keys());
  }

  /**
   * Teste un canal avec un destinataire
   */
  async test(channelName, template, recipient, variables) {
    const channel = this.get(channelName);

    return await channel.send(template, recipient, variables, {
      testMode: true
    });
  }

  /**
   * Envoie via plusieurs canaux en parallèle
   */
  async sendMulti(channelNames, template, recipient, variables, options = {}) {
    const promises = channelNames.map(name => {
      try {
        const channel = this.get(name);
        return channel.send(template, recipient, variables, options);
      } catch (error) {
        this.logger?.error(`[ChannelManager] Error with channel ${name}:`, error);
        return { success: false, error: error.message, channel: name };
      }
    });

    return await Promise.allSettled(promises);
  }
}
