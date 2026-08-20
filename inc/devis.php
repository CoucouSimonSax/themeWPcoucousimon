<?php
/**
 * Page de devis — les formules, et tout ce qui se passe côté serveur.
 *
 * Principe : le navigateur du visiteur ne parle qu'à coucousimon.tritons.eu.
 * C'est ce fichier qui interroge OpenStreetMap et qui envoie l'e-mail. Ni
 * l'adresse IP du visiteur ni la clé d'accès OpenRouteService ne sortent d'ici.
 *
 * @package coucousimon
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Point de départ des trajets : La Ciotat. */
const COUCOUSIMON_ORIGINE = array( 43.1768, 5.6043 );

/** Ce que le serveur annonce quand il interroge OpenStreetMap. */
const COUCOUSIMON_AGENT = 'CoucouSimon-Devis/1.0 (+https://coucousimon.tritons.eu)';

/**
 * Les formules et leurs tarifs. Source unique : la page les affiche depuis
 * ici, et le total de l'e-mail est recalculé ici. Modifier un prix se fait
 * donc à un seul endroit.
 *
 * `materiel` (1 à 3) dessine le motif de triangles de la carte : il compte le
 * matériel embarqué.
 *
 * @return array<string, array<string, mixed>>
 */
function coucousimon_devis_formules() {
	return array(
		'sax'        => array(
			'nom'         => __( 'Sax + amplification', 'coucousimon' ),
			'court'       => __( 'sax + ampli', 'coucousimon' ),
			'base'        => 400,
			'materiel'    => 2,
			'description' => __( 'Vous avez déjà un·e DJ : je joue par-dessus ses mix. Idéal pour cocktail ou soirée. Jusqu’à 3 h d’amplitude, fin avant 23 h. Au-delà, on en discute ensemble.', 'coucousimon' ),
		),
		'djsax'      => array(
			'nom'         => __( 'Sax + amplification + système son', 'coucousimon' ),
			'court'       => __( 'sax + ampli + sono', 'coucousimon' ),
			'base'        => 450,
			'materiel'    => 3,
			'description' => __( 'Je viens avec tout le matériel nécessaire pour le son : sax, sono, ordi, contrôleur. Rien à prévoir de votre côté. Idéal pour cocktail ou soirée clé en main. Jusqu’à 3 h d’amplitude, fin avant 23 h.', 'coucousimon' ),
		),
		'acoustique' => array(
			'nom'         => __( 'Sax acoustique', 'coucousimon' ),
			'court'       => __( 'acoustique', 'coucousimon' ),
			'base'        => 300,
			'materiel'    => 1,
			'description' => __( 'Saxophone acoustique, sans amplification ni DJ. Je joue sur des titres choisis, avec une enceinte portable. Idéal pour une cérémonie religieuse, une demande en mariage, ou un moment intimiste.', 'coucousimon' ),
		),
	);
}

/**
 * La clé d'accès à OpenRouteService, lue depuis wp-config.php.
 *
 * Elle n'a rien à faire dans le dépôt : celui-ci est public.
 *
 * @return string Chaîne vide si la constante n'est pas définie.
 */
function coucousimon_devis_cle_ors() {
	return defined( 'COUCOUSIMON_ORS_KEY' ) ? (string) COUCOUSIMON_ORS_KEY : '';
}

/**
 * L'adresse qui reçoit les demandes.
 *
 * @return string
 */
function coucousimon_devis_destinataire() {
	$adresse = defined( 'COUCOUSIMON_DEVIS_EMAIL' ) ? (string) COUCOUSIMON_DEVIS_EMAIL : get_option( 'admin_email' );

	return is_email( $adresse ) ? $adresse : get_option( 'admin_email' );
}

/**
 * Garde-fou contre les abus : compte les appels par visiteur sur 10 minutes.
 *
 * L'adresse IP n'est jamais stockée en clair, seulement son empreinte.
 *
 * @param string $cle      Identifiant du garde-fou (une par route).
 * @param int    $plafond  Nombre d'appels tolérés.
 * @return bool True si l'appel est autorisé.
 */
function coucousimon_devis_autorise( $cle, $plafond ) {
	$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';

	if ( '' === $ip ) {
		return true;
	}

	$transient = 'cs_devis_' . $cle . '_' . wp_hash( $ip );
	$compte    = (int) get_transient( $transient );

	if ( $compte >= $plafond ) {
		return false;
	}

	set_transient( $transient, $compte + 1, 10 * MINUTE_IN_SECONDS );

	return true;
}

/**
 * Déclare les routes de l'application de devis.
 */
function coucousimon_devis_routes() {
	register_rest_route(
		'coucousimon/v1',
		'/lieux',
		array(
			'methods'             => 'GET',
			'callback'            => 'coucousimon_devis_lieux',
			'permission_callback' => '__return_true',
			'args'                => array(
				'q' => array(
					'required'          => true,
					'sanitize_callback' => 'sanitize_text_field',
				),
			),
		)
	);

	register_rest_route(
		'coucousimon/v1',
		'/trajet',
		array(
			'methods'             => 'GET',
			'callback'            => 'coucousimon_devis_trajet',
			'permission_callback' => '__return_true',
			'args'                => array(
				'lat' => array( 'required' => true ),
				'lon' => array( 'required' => true ),
			),
		)
	);

	register_rest_route(
		'coucousimon/v1',
		'/demande',
		array(
			'methods'             => 'POST',
			'callback'            => 'coucousimon_devis_demande',
			'permission_callback' => '__return_true',
		)
	);
}
add_action( 'rest_api_init', 'coucousimon_devis_routes' );

/**
 * Cherche un lieu. Le serveur interroge Nominatim à la place du visiteur.
 *
 * @param WP_REST_Request $request Requête.
 * @return WP_REST_Response|WP_Error
 */
function coucousimon_devis_lieux( $request ) {
	if ( ! coucousimon_devis_autorise( 'lieux', 120 ) ) {
		return new WP_Error( 'trop_de_requetes', __( 'Trop de recherches d’un coup. Patientez une minute.', 'coucousimon' ), array( 'status' => 429 ) );
	}

	$q = trim( (string) $request->get_param( 'q' ) );

	if ( mb_strlen( $q ) < 3 || mb_strlen( $q ) > 120 ) {
		return rest_ensure_response( array() );
	}

	$cache = 'cs_devis_lieu_' . md5( mb_strtolower( $q ) );
	$vu    = get_transient( $cache );

	if ( false !== $vu ) {
		return rest_ensure_response( $vu );
	}

	$url = add_query_arg(
		array(
			'format'          => 'json',
			'q'               => rawurlencode( $q ),
			'limit'           => 5,
			'countrycodes'    => 'fr,mc',
			'accept-language' => 'fr',
		),
		'https://nominatim.openstreetmap.org/search'
	);

	$reponse = wp_remote_get(
		$url,
		array(
			'timeout'    => 8,
			'user-agent' => COUCOUSIMON_AGENT,
		)
	);

	if ( is_wp_error( $reponse ) || 200 !== wp_remote_retrieve_response_code( $reponse ) ) {
		return new WP_Error( 'recherche_indisponible', __( 'La recherche de lieu est momentanément indisponible.', 'coucousimon' ), array( 'status' => 503 ) );
	}

	$donnees = json_decode( wp_remote_retrieve_body( $reponse ), true );
	$lieux   = array();

	if ( is_array( $donnees ) ) {
		foreach ( $donnees as $item ) {
			if ( empty( $item['display_name'] ) || ! isset( $item['lat'], $item['lon'] ) ) {
				continue;
			}

			$morceaux = array_slice( explode( ',', $item['display_name'] ), 0, 3 );

			$lieux[] = array(
				'label' => trim( implode( ',', $morceaux ) ),
				'lat'   => (float) $item['lat'],
				'lon'   => (float) $item['lon'],
			);
		}
	}

	// Une journée de cache : les villes ne bougent pas, et cela ménage Nominatim.
	set_transient( $cache, $lieux, DAY_IN_SECONDS );

	return rest_ensure_response( $lieux );
}

/**
 * Calcule le trajet routier depuis La Ciotat.
 *
 * @param float $lat Latitude de destination.
 * @param float $lon Longitude de destination.
 * @return array{km:int, trace:array}|WP_Error
 */
function coucousimon_devis_calcule_trajet( $lat, $lon ) {
	$cle = coucousimon_devis_cle_ors();

	if ( '' === $cle ) {
		return new WP_Error( 'cle_absente', __( 'Le calcul de distance n’est pas configuré.', 'coucousimon' ), array( 'status' => 503 ) );
	}

	$cache = 'cs_devis_trajet_' . md5( round( $lat, 4 ) . '_' . round( $lon, 4 ) );
	$vu    = get_transient( $cache );

	if ( false !== $vu ) {
		return $vu;
	}

	$reponse = wp_remote_post(
		'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
		array(
			'timeout'    => 12,
			'user-agent' => COUCOUSIMON_AGENT,
			'headers'    => array(
				'Authorization' => $cle,
				'Content-Type'  => 'application/json',
			),
			'body'       => wp_json_encode(
				array(
					'coordinates' => array(
						array( COUCOUSIMON_ORIGINE[1], COUCOUSIMON_ORIGINE[0] ),
						array( $lon, $lat ),
					),
				)
			),
		)
	);

	if ( is_wp_error( $reponse ) || 200 !== wp_remote_retrieve_response_code( $reponse ) ) {
		return new WP_Error( 'trajet_indisponible', __( 'Le calcul de distance est momentanément indisponible.', 'coucousimon' ), array( 'status' => 503 ) );
	}

	$donnees = json_decode( wp_remote_retrieve_body( $reponse ), true );
	$metres  = $donnees['features'][0]['properties']['summary']['distance'] ?? null;

	if ( null === $metres ) {
		return new WP_Error( 'trajet_illisible', __( 'Le calcul de distance a échoué.', 'coucousimon' ), array( 'status' => 503 ) );
	}

	$trajet = array(
		'km'    => (int) round( $metres / 1000 ),
		'trace' => $donnees['features'][0]['geometry']['coordinates'] ?? array(),
	);

	set_transient( $cache, $trajet, WEEK_IN_SECONDS );

	return $trajet;
}

/**
 * Route du trajet.
 *
 * @param WP_REST_Request $request Requête.
 * @return WP_REST_Response|WP_Error
 */
function coucousimon_devis_trajet( $request ) {
	if ( ! coucousimon_devis_autorise( 'trajet', 60 ) ) {
		return new WP_Error( 'trop_de_requetes', __( 'Trop de calculs d’un coup. Patientez une minute.', 'coucousimon' ), array( 'status' => 429 ) );
	}

	$lat = (float) $request->get_param( 'lat' );
	$lon = (float) $request->get_param( 'lon' );

	if ( $lat < -90 || $lat > 90 || $lon < -180 || $lon > 180 ) {
		return new WP_Error( 'coordonnees_invalides', __( 'Coordonnées invalides.', 'coucousimon' ), array( 'status' => 400 ) );
	}

	$trajet = coucousimon_devis_calcule_trajet( $lat, $lon );

	if ( is_wp_error( $trajet ) ) {
		return $trajet;
	}

	return rest_ensure_response( $trajet );
}

/**
 * Reçoit une demande, recalcule le total, envoie l'e-mail.
 *
 * Le total n'est jamais repris du navigateur : il est recalculé ici, sinon
 * n'importe qui pourrait faire arriver « total : 0 € » dans la boîte mail.
 *
 * @param WP_REST_Request $request Requête.
 * @return WP_REST_Response|WP_Error
 */
function coucousimon_devis_demande( $request ) {
	// Champ piège : invisible pour un humain, rempli par les robots.
	if ( '' !== trim( (string) $request->get_param( 'site' ) ) ) {
		return rest_ensure_response( array( 'envoye' => true ) );
	}

	if ( ! coucousimon_devis_autorise( 'demande', 5 ) ) {
		return new WP_Error( 'trop_de_requetes', __( 'Vous avez déjà envoyé plusieurs demandes. Patientez un moment, ou appelez directement le 06 77 57 40 28.', 'coucousimon' ), array( 'status' => 429 ) );
	}

	$formules = coucousimon_devis_formules();
	$cle      = sanitize_key( (string) $request->get_param( 'formule' ) );

	if ( ! isset( $formules[ $cle ] ) ) {
		return new WP_Error( 'formule_inconnue', __( 'Merci de choisir une formule.', 'coucousimon' ), array( 'status' => 400 ) );
	}

	$nom     = sanitize_text_field( (string) $request->get_param( 'nom' ) );
	$email   = sanitize_email( (string) $request->get_param( 'email' ) );
	$message = sanitize_textarea_field( (string) $request->get_param( 'message' ) );
	$lieu    = sanitize_text_field( (string) $request->get_param( 'lieu' ) );

	if ( '' === $nom || mb_strlen( $nom ) > 120 ) {
		return new WP_Error( 'nom_invalide', __( 'Merci d’indiquer votre nom.', 'coucousimon' ), array( 'status' => 400 ) );
	}

	if ( ! is_email( $email ) ) {
		return new WP_Error( 'email_invalide', __( 'Cette adresse e-mail ne semble pas valide.', 'coucousimon' ), array( 'status' => 400 ) );
	}

	if ( mb_strlen( $message ) > 4000 ) {
		$message = mb_substr( $message, 0, 4000 );
	}

	$formule = $formules[ $cle ];
	$km      = 0;

	// La distance est recalculée à partir des coordonnées, pas reprise du navigateur.
	$lat = $request->get_param( 'lat' );
	$lon = $request->get_param( 'lon' );

	if ( null !== $lat && null !== $lon ) {
		$trajet = coucousimon_devis_calcule_trajet( (float) $lat, (float) $lon );

		if ( ! is_wp_error( $trajet ) ) {
			$km = $trajet['km'];
		}
	}

	$total = $formule['base'] + $km;

	$corps = array(
		__( 'DEMANDE DE PRESTATION — COUCOU SIMON', 'coucousimon' ),
		'',
		sprintf( '%s : %s', __( 'Formule', 'coucousimon' ), $formule['court'] ),
		sprintf( '%s : %s', __( 'Lieu', 'coucousimon' ), '' !== $lieu ? $lieu : __( 'non précisé', 'coucousimon' ) ),
		sprintf( '%s : %d km', __( 'Distance', 'coucousimon' ), $km ),
		sprintf( '%s : %d €', __( 'Base', 'coucousimon' ), $formule['base'] ),
		sprintf( '%s : %d €', __( 'Déplacement', 'coucousimon' ), $km ),
		sprintf( '%s : %d €', __( 'TOTAL ESTIMÉ', 'coucousimon' ), $total ),
		'',
		'---',
		sprintf( '%s : %s', __( 'Nom', 'coucousimon' ), $nom ),
		sprintf( '%s : %s', __( 'E-mail', 'coucousimon' ), $email ),
		'',
		__( 'Message :', 'coucousimon' ),
		'' !== $message ? $message : __( '(aucun)', 'coucousimon' ),
	);

	$envoye = wp_mail(
		coucousimon_devis_destinataire(),
		sprintf(
			/* translators: %s: nom du demandeur. */
			__( 'Demande de devis — %s', 'coucousimon' ),
			$nom
		),
		implode( "\n", $corps ),
		array(
			'Content-Type: text/plain; charset=UTF-8',
			sprintf( 'Reply-To: %s <%s>', $nom, $email ),
		)
	);

	if ( ! $envoye ) {
		return new WP_Error( 'envoi_impossible', __( 'L’envoi a échoué. Appelez Simon directement au 06 77 57 40 28.', 'coucousimon' ), array( 'status' => 500 ) );
	}

	return rest_ensure_response( array( 'envoye' => true ) );
}
