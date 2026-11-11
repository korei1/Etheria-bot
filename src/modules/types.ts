import type { Client } from "discord.js";

/**
 * Contrat commun des futurs modules de jeu.
 * La logique métier devra rester indépendante de Discord lorsque possible.
 */
export interface EtheriaModule {
  readonly name: string;
  register?(client: Client): Promise<void> | void;
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
}
