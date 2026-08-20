<?php
/**
 * Coucou Simon — amorçage du thème.
 *
 * Un thème bloc n'a presque pas besoin de PHP : tout le style vient de
 * theme.json. Ce fichier ne sert qu'à charger style.css, que WordPress
 * ne joint pas automatiquement à la page.
 *
 * @package coucousimon
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once get_theme_file_path( 'inc/devis.php' );

/**
 * Charge la feuille de style du thème côté site public.
 */
function coucousimon_enqueue_styles() {
	wp_enqueue_style(
		'coucousimon-style',
		get_stylesheet_uri(),
		array(),
		wp_get_theme()->get( 'Version' )
	);
}
add_action( 'wp_enqueue_scripts', 'coucousimon_enqueue_styles' );

/**
 * Même feuille de style dans l'éditeur de blocs.
 */
function coucousimon_editor_styles() {
	add_editor_style( 'style.css' );
}
add_action( 'after_setup_theme', 'coucousimon_editor_styles' );

/**
 * Catégorie de patterns propre au thème.
 */
function coucousimon_pattern_category() {
	register_block_pattern_category(
		'coucousimon',
		array( 'label' => __( 'Coucou Simon', 'coucousimon' ) )
	);
}
add_action( 'init', 'coucousimon_pattern_category' );

/**
 * Charge le script du devis, uniquement sur la page qui en a besoin.
 *
 * On repère la page au gabarit qu'elle a choisi, pas à son adresse : Simon
 * doit pouvoir renommer la page sans que le devis cesse de fonctionner.
 */
function coucousimon_enqueue_devis_script() {
	if ( ! is_page() || 'devis' !== get_page_template_slug() ) {
		return;
	}

	wp_enqueue_script(
		'coucousimon-devis',
		get_theme_file_uri( 'assets/js/devis.js' ),
		array(),
		wp_get_theme()->get( 'Version' ),
		array(
			'in_footer' => true,
			'strategy'  => 'defer',
		)
	);

	// L'adresse des routes du thème. C'est la seule adresse que le script appelle.
	wp_add_inline_script(
		'coucousimon-devis',
		'window.coucousimonDevis = ' . wp_json_encode(
			array( 'racine' => esc_url_raw( rest_url( 'coucousimon/v1/' ) ) )
		) . ';',
		'before'
	);
}
add_action( 'wp_enqueue_scripts', 'coucousimon_enqueue_devis_script' );
