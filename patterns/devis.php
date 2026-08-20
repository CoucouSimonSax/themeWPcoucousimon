<?php
/**
 * Title: Page de devis
 * Slug: coucousimon/devis
 * Categories: coucousimon
 * Inserter: no
 * Description: Le simulateur de devis — choix de la formule, lieu, estimation, coordonnées.
 *
 * Exception assumée à la règle « markup de blocs uniquement » : cette page est
 * une application, pas une mise en page. Elle vit donc en HTML dans ce fichier,
 * versionné, plutôt qu'en base de données.
 *
 * Les formules et leurs tarifs viennent de inc/devis.php : c'est leur source
 * unique, celle que le serveur utilise aussi pour recalculer le total.
 *
 * @package coucousimon
 */

$coucousimon_formules = coucousimon_devis_formules();

/*
 * Le motif de chaque carte compte le matériel embarqué : un triangle par
 * élément. Un dessin, pas une donnée — d'où l'aria-hidden.
 */
$coucousimon_triangles = array(
	'M12 8 L23 40 L1 40 Z',
	'M30 18 L39 40 L21 40 Z',
	'M43 28 L48 40 L38 40 Z',
);

$coucousimon_opacites = array( '1', '.62', '.38' );

?>
<?php
/*
 * Le motif du design system, en fond de page. Version fixe : le design system
 * fournit aussi une variante animée (assets/motifs/triangles-live.js), à
 * reprendre à la source le jour où on la voudra.
 */
?>
<div class="devis-fond" aria-hidden="true"></div>

<div class="devis" data-devis>

	<!-- Écran 1 — formule, lieu, estimation -->
	<section class="devis__step is-active" data-devis-step="1" aria-label="<?php esc_attr_e( 'Votre devis', 'coucousimon' ); ?>">

		<header class="devis__intro">
			<h1 class="devis__title"><?php esc_html_e( 'Demande de devis', 'coucousimon' ); ?></h1>
			<p class="devis__subtitle"><?php esc_html_e( 'Coucou Simon · saxophone · La Ciotat', 'coucousimon' ); ?></p>
		</header>

		<fieldset class="devis__section devis__fieldset">
			<legend class="devis__label"><?php esc_html_e( 'Formule', 'coucousimon' ); ?></legend>

			<div class="devis__cards">
				<?php foreach ( $coucousimon_formules as $coucousimon_cle => $coucousimon_formule ) : ?>
					<label class="devis-card">
						<input type="radio" name="devis-formule" class="devis-card__input"
							value="<?php echo esc_attr( $coucousimon_cle ); ?>"
							data-label="<?php echo esc_attr( $coucousimon_formule['court'] ); ?>"
							data-base="<?php echo esc_attr( (string) $coucousimon_formule['base'] ); ?>">

						<span class="devis-card__figure" aria-hidden="true">
							<svg viewBox="0 0 48 48" focusable="false">
								<?php for ( $coucousimon_i = 0; $coucousimon_i < (int) $coucousimon_formule['materiel']; $coucousimon_i++ ) : ?>
									<path d="<?php echo esc_attr( $coucousimon_triangles[ $coucousimon_i ] ); ?>" fill="currentColor" opacity="<?php echo esc_attr( $coucousimon_opacites[ $coucousimon_i ] ); ?>"/>
								<?php endfor; ?>
							</svg>
						</span>

						<?php /* Toujours dans le document pour les lecteurs d'écran ; révélé au survol. */ ?>
						<span class="devis-card__name"><?php echo esc_html( $coucousimon_formule['nom'] ); ?></span>
					</label>
				<?php endforeach; ?>
			</div>

			<?php /* Le descriptif de la formule retenue. Les trois sont dans la page, un seul est montré. */ ?>
			<div class="devis__details">
				<?php foreach ( $coucousimon_formules as $coucousimon_cle => $coucousimon_formule ) : ?>
					<div class="devis__detail" data-devis-detail="<?php echo esc_attr( $coucousimon_cle ); ?>" hidden>
						<p class="devis__detail-head">
							<span class="devis__detail-name"><?php echo esc_html( $coucousimon_formule['nom'] ); ?></span>
							<span class="devis__detail-price"><?php echo esc_html( number_format_i18n( $coucousimon_formule['base'] ) ); ?>&nbsp;€</span>
						</p>
						<p class="devis__detail-desc"><?php echo esc_html( $coucousimon_formule['description'] ); ?></p>
					</div>
				<?php endforeach; ?>
			</div>
		</fieldset>

		<div class="devis__section devis__field">
			<label class="devis__label" for="devis-lieu"><?php esc_html_e( 'Lieu de l’événement', 'coucousimon' ); ?></label>
			<input type="text" id="devis-lieu" class="devis__input" autocomplete="off" spellcheck="false"
				role="combobox" aria-expanded="false" aria-controls="devis-suggestions" aria-autocomplete="list"
				placeholder="<?php esc_attr_e( 'Ville ou adresse', 'coucousimon' ); ?>">
			<div class="devis__suggestions" id="devis-suggestions" role="listbox" hidden></div>
			<p class="devis__hint" data-devis-lieu-info role="status"></p>

			<?php
			/*
			 * La carte apparaît dès qu'un trajet est calculé, sans rien demander
			 * — choix de Simon, comme dans la version d'origine. Ses tuiles
			 * viennent d'OpenStreetMap : le visiteur qui choisit un lieu y
			 * transmet donc son adresse IP. La mention sous la carte le dit.
			 */
			?>
			<div class="devis__carte" data-devis-carte hidden>
				<div class="devis__carte-toile" data-devis-carte-toile></div>
			</div>
			<p class="devis__carte-mention" data-devis-carte-mention hidden><?php esc_html_e( 'Fond de carte OpenStreetMap.', 'coucousimon' ); ?></p>
		</div>

		<div class="devis__section">
			<div class="devis__total">
				<span class="devis__total-main">
					<span class="devis__total-label"><?php esc_html_e( 'Estimation', 'coucousimon' ); ?></span>
					<span class="devis__total-amount" data-devis-total role="status">—</span>
				</span>
				<span class="devis__total-note"><?php esc_html_e( 'Frais de déplacement inclus', 'coucousimon' ); ?></span>
			</div>
			<p class="devis__total-detail" data-devis-total-detail></p>
			<p class="devis__note"><?php esc_html_e( 'Chaque prestation est discutée et adaptée à votre événement. Si vous souhaitez des titres spécifiques, une ambiance particulière, ou même cumuler plusieurs formules, faites-le nous savoir en envoyant la demande !', 'coucousimon' ); ?></p>
		</div>

		<button type="button" class="devis__btn devis__btn--primary" data-devis-next disabled>
			<?php esc_html_e( 'Envoyer une demande', 'coucousimon' ); ?>
		</button>
	</section>

	<!-- Écran 2 — récapitulatif et coordonnées -->
	<section class="devis__step" data-devis-step="2" aria-label="<?php esc_attr_e( 'Vos coordonnées', 'coucousimon' ); ?>" hidden>

		<header class="devis__intro">
			<h2 class="devis__title"><?php esc_html_e( 'Votre demande', 'coucousimon' ); ?></h2>
			<p class="devis__subtitle"><?php esc_html_e( 'Récapitulatif et coordonnées', 'coucousimon' ); ?></p>
		</header>

		<div class="devis__recap" data-devis-recap></div>

		<div class="devis__section devis__field">
			<label class="devis__label" for="devis-nom"><?php esc_html_e( 'Nom et prénom', 'coucousimon' ); ?></label>
			<input type="text" id="devis-nom" class="devis__input" autocomplete="name" placeholder="Marie Dupont" required>
		</div>

		<div class="devis__section devis__field">
			<label class="devis__label" for="devis-email"><?php esc_html_e( 'E-mail', 'coucousimon' ); ?></label>
			<input type="email" id="devis-email" class="devis__input" autocomplete="email" placeholder="marie@exemple.fr" required>
		</div>

		<div class="devis__section devis__field">
			<label class="devis__label" for="devis-message"><?php esc_html_e( 'Dites-nous en plus !', 'coucousimon' ); ?></label>
			<textarea id="devis-message" class="devis__textarea" rows="5" placeholder="<?php esc_attr_e( 'Date, type d’événement, nombre d’invités, ambiance souhaitée, questions…', 'coucousimon' ); ?>"></textarea>
		</div>

		<?php /* Champ piège anti-robot : invisible et hors du parcours clavier. */ ?>
		<div class="devis__piege" aria-hidden="true">
			<label for="devis-site"><?php esc_html_e( 'Ne remplissez pas ce champ', 'coucousimon' ); ?></label>
			<input type="text" id="devis-site" tabindex="-1" autocomplete="off">
		</div>

		<p class="devis__erreur" data-devis-erreur role="alert" hidden></p>

		<button type="button" class="devis__btn devis__btn--primary" data-devis-submit>
			<?php esc_html_e( 'Envoyer la demande', 'coucousimon' ); ?>
		</button>

		<button type="button" class="devis__btn devis__btn--secondary" data-devis-back>
			<?php esc_html_e( '← Modifier le devis', 'coucousimon' ); ?>
		</button>
	</section>

	<!-- Écran 3 — confirmation -->
	<section class="devis__step devis__done" data-devis-step="3" aria-label="<?php esc_attr_e( 'Confirmation', 'coucousimon' ); ?>" hidden>
		<h2 class="devis__title"><?php esc_html_e( 'Demande envoyée !', 'coucousimon' ); ?></h2>
		<p><?php esc_html_e( 'Merci ! Simon vous répondra dans les meilleurs délais.', 'coucousimon' ); ?></p>
		<p><?php esc_html_e( 'En attendant :', 'coucousimon' ); ?> <a href="tel:+33677574028">+33 6 77 57 40 28</a></p>
	</section>

</div>
