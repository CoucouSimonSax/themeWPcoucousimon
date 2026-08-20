/**
 * Page de devis — Coucou Simon.
 *
 * Le script ne connaît aucun tarif : il les lit sur les attributs data- des
 * cartes, que le pattern remplit depuis inc/devis.php. Il n'appelle que le
 * site lui-même : c'est le serveur qui interroge OpenStreetMap.
 */
( function () {
	'use strict';

	var root = document.querySelector( '[data-devis]' );

	if ( ! root || 'undefined' === typeof window.coucousimonDevis ) {
		return;
	}

	var api = window.coucousimonDevis.racine;

	/** État courant du devis. */
	var state = {
		formule: null,
		label: '',
		base: 0,
		lieu: null,
		lat: null,
		lon: null,
		distance: null,
		total: null
	};

	var steps = root.querySelectorAll( '[data-devis-step]' );
	var totalEl = root.querySelector( '[data-devis-total]' );
	var detailEl = root.querySelector( '[data-devis-total-detail]' );
	var recapEl = root.querySelector( '[data-devis-recap]' );
	var erreurEl = root.querySelector( '[data-devis-erreur]' );
	var lieuInfoEl = root.querySelector( '[data-devis-lieu-info]' );
	var lieuInput = root.querySelector( '#devis-lieu' );
	var suggestionsEl = root.querySelector( '#devis-suggestions' );
	var nextBtn = root.querySelector( '[data-devis-next]' );
	var backBtn = root.querySelector( '[data-devis-back]' );
	var submitBtn = root.querySelector( '[data-devis-submit]' );

	var chercheTimer = null;
	var enCours = false;

	/**
	 * Affiche un écran et masque les autres.
	 *
	 * @param {string} n Numéro de l'écran.
	 */
	function showStep( n ) {
		Array.prototype.forEach.call( steps, function ( step ) {
			var active = step.getAttribute( 'data-devis-step' ) === n;
			step.classList.toggle( 'is-active', active );
			step.hidden = ! active;
		} );
		root.scrollIntoView( { behavior: 'smooth', block: 'start' } );
	}

	/** Formate un montant en euros, sans décimale. */
	function euros( n ) {
		return n.toLocaleString( 'fr-FR' ) + ' €';
	}

	/** Recalcule l'estimation et l'état du bouton. */
	function recalculate() {
		if ( ! state.formule ) {
			totalEl.textContent = '—';
			detailEl.textContent = '';
			nextBtn.disabled = true;
			return;
		}

		var km = state.distance || 0;

		state.total = state.base + km;

		totalEl.textContent = euros( state.total );

		var detail = euros( state.base ) + ' (' + state.label + ')';

		if ( km ) {
			detail += ' + ' + euros( km ) + ' (déplacement)';
		}

		detailEl.textContent = detail;
		nextBtn.disabled = false;
	}

	/** Ferme la liste de suggestions. */
	function fermeSuggestions() {
		suggestionsEl.textContent = '';
		suggestionsEl.hidden = true;
		lieuInput.setAttribute( 'aria-expanded', 'false' );
	}

	/**
	 * Affiche les lieux proposés par le serveur.
	 *
	 * @param {Array} lieux Résultats.
	 */
	function afficheSuggestions( lieux ) {
		suggestionsEl.textContent = '';

		if ( ! lieux.length ) {
			fermeSuggestions();
			return;
		}

		lieux.forEach( function ( lieu ) {
			var bouton = document.createElement( 'button' );
			bouton.type = 'button';
			bouton.className = 'devis__suggestion';
			bouton.setAttribute( 'role', 'option' );
			bouton.textContent = lieu.label;
			bouton.addEventListener( 'click', function () {
				choisitLieu( lieu );
			} );
			suggestionsEl.appendChild( bouton );
		} );

		suggestionsEl.hidden = false;
		lieuInput.setAttribute( 'aria-expanded', 'true' );
	}

	/**
	 * Retient le lieu choisi et demande la distance au serveur.
	 *
	 * @param {Object} lieu Lieu retenu.
	 */
	function choisitLieu( lieu ) {
		lieuInput.value = lieu.label;
		state.lieu = lieu.label;
		state.lat = lieu.lat;
		state.lon = lieu.lon;

		fermeSuggestions();
		lieuInfoEl.textContent = 'Calcul du trajet…';

		fetch( api + 'trajet?lat=' + encodeURIComponent( lieu.lat ) + '&lon=' + encodeURIComponent( lieu.lon ) )
			.then( function ( r ) {
				return r.json().then( function ( data ) {
					if ( ! r.ok ) {
						throw new Error( data.message || 'Calcul indisponible.' );
					}
					return data;
				} );
			} )
			.then( function ( trajet ) {
				state.distance = trajet.km;
				lieuInfoEl.textContent = trajet.km + ' km depuis La Ciotat · frais de déplacement ' + euros( trajet.km );
				recalculate();
			} )
			.catch( function ( e ) {
				state.distance = null;
				lieuInfoEl.textContent = e.message;
				recalculate();
			} );
	}

	/** Construit le récapitulatif de l'écran 2. */
	function buildRecap() {
		var km = state.distance || 0;
		var lines = [ [ 'Formule', state.label ] ];

		if ( state.lieu ) {
			lines.push( [ 'Lieu', state.lieu ] );
		}

		lines.push( [ 'Base', euros( state.base ) ] );

		if ( km ) {
			lines.push( [ 'Distance', km + ' km' ] );
			lines.push( [ 'Déplacement', euros( km ) ] );
		}

		lines.push( [ 'Total estimé', euros( state.total ) ] );

		recapEl.textContent = '';

		var title = document.createElement( 'h3' );
		title.className = 'devis__recap-title';
		title.textContent = 'Récapitulatif';
		recapEl.appendChild( title );

		lines.forEach( function ( line ) {
			var row = document.createElement( 'p' );
			row.className = 'devis__recap-line';

			var key = document.createElement( 'span' );
			key.textContent = line[ 0 ];

			var value = document.createElement( 'span' );
			value.textContent = line[ 1 ];

			row.appendChild( key );
			row.appendChild( value );
			recapEl.appendChild( row );
		} );
	}

	/**
	 * Affiche ou efface le message d'erreur de l'écran 2.
	 *
	 * @param {string} texte Message, ou chaîne vide pour effacer.
	 */
	function erreur( texte ) {
		erreurEl.textContent = texte;
		erreurEl.hidden = '' === texte;
	}

	/** Envoie la demande au serveur, qui envoie l'e-mail. */
	function envoie() {
		if ( enCours ) {
			return;
		}

		var nom = root.querySelector( '#devis-nom' ).value.trim();
		var email = root.querySelector( '#devis-email' ).value.trim();
		var message = root.querySelector( '#devis-message' ).value.trim();

		if ( ! nom ) {
			erreur( 'Merci d’indiquer votre nom.' );
			return;
		}

		if ( ! email ) {
			erreur( 'Merci d’indiquer votre e-mail, sans quoi Simon ne pourra pas vous répondre.' );
			return;
		}

		erreur( '' );
		enCours = true;
		submitBtn.disabled = true;
		submitBtn.textContent = 'Envoi…';

		fetch( api + 'demande', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( {
				formule: state.formule,
				lieu: state.lieu,
				lat: state.lat,
				lon: state.lon,
				nom: nom,
				email: email,
				message: message,
				site: root.querySelector( '#devis-site' ).value
			} )
		} )
			.then( function ( r ) {
				return r.json().then( function ( data ) {
					if ( ! r.ok ) {
						throw new Error( data.message || 'L’envoi a échoué.' );
					}
					return data;
				} );
			} )
			.then( function () {
				showStep( '3' );
			} )
			.catch( function ( e ) {
				erreur( e.message );
			} )
			.finally( function () {
				enCours = false;
				submitBtn.disabled = false;
				submitBtn.textContent = 'Envoyer la demande';
			} );
	}

	root.addEventListener( 'change', function ( event ) {
		var input = event.target;

		if ( ! input.matches || ! input.matches( '.devis-card__input' ) ) {
			return;
		}

		state.formule = input.value;
		state.label = input.getAttribute( 'data-label' ) || input.value;
		state.base = parseInt( input.getAttribute( 'data-base' ), 10 ) || 0;

		recalculate();
	} );

	lieuInput.addEventListener( 'input', function () {
		var q = lieuInput.value.trim();

		// Le lieu tapé ne vaut plus rien tant qu'il n'est pas re-choisi dans la liste.
		state.lieu = null;
		state.lat = null;
		state.lon = null;
		state.distance = null;
		lieuInfoEl.textContent = '';
		recalculate();

		window.clearTimeout( chercheTimer );

		if ( q.length < 3 ) {
			fermeSuggestions();
			return;
		}

		chercheTimer = window.setTimeout( function () {
			fetch( api + 'lieux?q=' + encodeURIComponent( q ) )
				.then( function ( r ) {
					return r.ok ? r.json() : [];
				} )
				.then( afficheSuggestions )
				.catch( function () {
					fermeSuggestions();
				} );
		}, 400 );
	} );

	lieuInput.addEventListener( 'keydown', function ( event ) {
		if ( 'Escape' === event.key ) {
			fermeSuggestions();
		}
	} );

	document.addEventListener( 'click', function ( event ) {
		if ( ! suggestionsEl.hidden && ! suggestionsEl.contains( event.target ) && event.target !== lieuInput ) {
			fermeSuggestions();
		}
	} );

	nextBtn.addEventListener( 'click', function () {
		if ( ! state.formule ) {
			return;
		}

		erreur( '' );
		buildRecap();
		showStep( '2' );
	} );

	backBtn.addEventListener( 'click', function () {
		showStep( '1' );
	} );

	submitBtn.addEventListener( 'click', envoie );

	recalculate();
}() );
