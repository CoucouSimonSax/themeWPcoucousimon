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

	var carteEl = root.querySelector( '[data-devis-carte]' );
	var carteToile = root.querySelector( '[data-devis-carte-toile]' );
	var carteVoile = root.querySelector( '[data-devis-carte-voile]' );
	var carteBouton = root.querySelector( '[data-devis-carte-afficher]' );

	var chercheTimer = null;
	var enCours = false;

	var carte = null;
	var trace = null;
	var pointArrivee = null;

	/** Mémoire du consentement, pour ne pas le redemander à chaque changement de ville. */
	var CLE_CONSENTEMENT = 'coucousimon-carte';

	/** Le visiteur a-t-il déjà accepté d'afficher la carte pendant cette visite ? */
	function carteAcceptee() {
		try {
			return 'oui' === window.sessionStorage.getItem( CLE_CONSENTEMENT );
		} catch ( e ) {
			return false;
		}
	}

	/** Retient le consentement pour la durée de la visite. */
	function retientConsentement() {
		try {
			window.sessionStorage.setItem( CLE_CONSENTEMENT, 'oui' );
		} catch ( e ) {}
	}

	/**
	 * Charge Leaflet depuis le thème, une seule fois, au moment où on en a besoin.
	 *
	 * @return {Promise} Résolue quand L est disponible.
	 */
	function chargeLeaflet() {
		if ( window.L ) {
			return Promise.resolve();
		}

		return new Promise( function ( resolve, reject ) {
			var css = document.createElement( 'link' );
			css.rel = 'stylesheet';
			css.href = window.coucousimonDevis.leafletCss;
			document.head.appendChild( css );

			var js = document.createElement( 'script' );
			js.src = window.coucousimonDevis.leafletJs;
			js.onload = resolve;
			js.onerror = function () {
				reject( new Error( 'La carte n’a pas pu être chargée.' ) );
			};
			document.head.appendChild( js );
		} );
	}

	/** Un repère carré, dessiné en CSS : pas d'image à charger. */
	function repere( modificateur ) {
		return window.L.divIcon( {
			className: 'devis__repere devis__repere--' + modificateur,
			iconSize: [ 14, 14 ],
			iconAnchor: [ 7, 7 ]
		} );
	}

	/** Dessine le trajet. Suppose le consentement déjà donné. */
	function dessineCarte() {
		if ( ! trace || ! trace.length ) {
			return;
		}

		chargeLeaflet()
			.then( function () {
				var L = window.L;
				var origine = window.coucousimonDevis.origine;
				var bleu = getComputedStyle( document.documentElement )
					.getPropertyValue( '--wp--preset--color--blue-500' ).trim() || '#00cccc';

				carteVoile.hidden = true;

				if ( ! carte ) {
					carte = L.map( carteToile, { scrollWheelZoom: false } );
					L.tileLayer( 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
						attribution: '© OpenStreetMap',
						maxZoom: 18
					} ).addTo( carte );
					L.marker( origine, { icon: repere( 'depart' ) } )
						.bindTooltip( window.coucousimonDevis.origineNom )
						.addTo( carte );
				}

				if ( carte.__trajet ) {
					carte.removeLayer( carte.__trajet );
				}

				if ( carte.__arrivee ) {
					carte.removeLayer( carte.__arrivee );
				}

				// L'API rend des couples longitude/latitude ; Leaflet les veut inversés.
				var points = trace.map( function ( c ) {
					return [ c[ 1 ], c[ 0 ] ];
				} );

				carte.__trajet = L.polyline( points, { color: bleu, weight: 4, opacity: 0.9 } ).addTo( carte );
				carte.__arrivee = L.marker( pointArrivee, { icon: repere( 'arrivee' ) } ).addTo( carte );

				// La carte a été dessinée dans un bloc masqué : il faut la remesurer.
				carte.invalidateSize();
				carte.fitBounds( carte.__trajet.getBounds(), { padding: [ 24, 24 ] } );
			} )
			.catch( function ( e ) {
				lieuInfoEl.textContent = e.message;
			} );
	}

	/** Range la carte quand il n'y a plus de trajet à montrer. */
	function cacheCarte() {
		trace = null;
		pointArrivee = null;
		carteEl.hidden = true;
	}

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
				lieuInfoEl.textContent = trajet.km + ' km depuis ' + window.coucousimonDevis.origineNom +
					' · frais de déplacement ' + euros( trajet.km );

				trace = trajet.trace;
				pointArrivee = [ lieu.lat, lieu.lon ];
				carteEl.hidden = false;

				if ( carteAcceptee() ) {
					dessineCarte();
				}

				recalculate();
			} )
			.catch( function ( e ) {
				state.distance = null;
				lieuInfoEl.textContent = e.message;
				cacheCarte();
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
		cacheCarte();
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

	carteBouton.addEventListener( 'click', function () {
		retientConsentement();
		dessineCarte();
	} );

	submitBtn.addEventListener( 'click', envoie );

	recalculate();
}() );
