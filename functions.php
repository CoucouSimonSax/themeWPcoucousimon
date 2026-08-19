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
