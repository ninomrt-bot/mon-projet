// lib/providers/asana.js

/**
 * Fournit la configuration OAuth “Asana” pour NextAuth.
 * @param {{ clientId: string, clientSecret: string }} options
 */
export default function AsanaProvider(options) {
  return {
    id: "asana",
    name: "Asana",
    type: "oauth",
    version: "2.0",
    scope: "default",
    params: { grant_type: "authorization_code" },

    // URL d’autorisation Asana
    authorization: {
      url: "https://app.asana.com/-/oauth_authorize",
      params: { response_type: "code" }
    },
    // URL d’échange du code contre access_token
    token: "https://app.asana.com/-/oauth_token",
    // URL pour récupérer le profil utilisateur Asana
    userinfo: "https://app.asana.com/api/1.0/users/me",

    clientId: options.clientId,
    clientSecret: options.clientSecret,

    /**
     * Transforme la réponse de “GET /users/me” en objet utilisateur NextAuth
     * Asana renvoie : { data: { gid, name, email, photo: { image_60x60, … } } }
     */
    async profile(profileResponse) {
      const user = profileResponse.data;
      return {
        id: user.gid,
        name: user.name,
        email: user.email || null,
        image: user.photo?.image_60x60 || null
      };
    },

    ...options
  };
}
