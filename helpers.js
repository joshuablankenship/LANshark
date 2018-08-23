const axios = require('axios');
const fetch = require('node-fetch');
const scrapeIt = require('scrape-it');
const db = require('./database-mySql/dbHelpers.js');

exports.formatResults = (results) => {
  let fResults = results.replace(/\[(.*?)\]/g, ' ');
  fResults = fResults.replace(/[\r\n]/g, ' ');
  fResults = fResults.replace(/<[^>]+>/g, ' ');
  fResults = fResults.trim();
  fResults = fResults.split('—');
  fResults = fResults.join(' ');
  fResults = fResults.split(' ');
  fResults.forEach((result, i) => {
    fResults[i] = result.trim();
    fResults[i] = fResults[i].split(' ');

    fResults[i] = fResults[i].join('');
    fResults[i] = fResults[i].split('');
    if (fResults[i].length < 7 && fResults[i][0]) {
      fResults[i].forEach((char) => {
        if (char === char.toUpperCase()) {
          fResults.splice(i, 1, fResults[i].join('').replace(/\./g, ''));
        }
      });
    }
  });
  fResults = fResults.join(' ');
  fResults = fResults.split(/[,.;]+/);
  fResults.forEach((result, i) => {
    fResults[i] = result.trim();
    fResults[i] = fResults[i].replace(/ {2}/g, ' ');
    fResults[i] = fResults[i].replace(/ {2}/g, ' ');
  });
  return fResults;
};
exports.getNeighborhood = (lat, long) => {
  const endpointUrl = 'https://query.wikidata.org/sparql';


  const sparqlQuery = `PREFIX geo: <http://www.opengis.net/ont/geosparql#>

    SELECT ?place ?placeLabel ?image ?coordinate_location ?dist ?instance_of ?instance_ofLabel WHERE {
      SERVICE wikibase:around {
        ?place wdt:P625 ?coordinate_location.
        bd:serviceParam wikibase:center "Point(${long} ${lat})"^^geo:wktLiteral.
        bd:serviceParam wikibase:radius "1".
        bd:serviceParam wikibase:distance ?dist.
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
      OPTIONAL { ?place wdt:P18 ?image. }
      OPTIONAL { ?place wdt:P31 ?instance_of. }
    }
    ORDER BY ASC(?dist)
    LIMIT 100`;


  const fullUrl = `${endpointUrl}?query=${encodeURIComponent(sparqlQuery)}`;


  const headers = {
    Accept: 'application/sparql-results+json',
  };

  return fetch(fullUrl, {
    headers,
  });
};
exports.formatNeighborhoodData = ((json) => {
  const hood = [];
  const place = {};
  const places = [];
  const {
    head: {
      vars,
    },
    results,
  } = json;
  for (const result of results.bindings) {
    hood.push(result);
    for (const variable of vars) {
      place[variable] = result[variable];
    }
  }
  hood.forEach((place) => {
    // filter out results that don't have a title
    let type = null;
    let dist = null;
    if (place.instance_ofLabel !== undefined) {
      type = place.instance_ofLabel.value;
    }
    if (place.dist !== undefined) {
      dist = place.dist.value;
    }
    if (place.placeLabel.value[0] !== 'Q' && place.placeLabel.value.length !== 9) {
      if (place.placeLabel) {
        places.push({
          title: place.placeLabel.value,
          coord: place.coordinate_location.value.slice(6, -1),
          dist,
          type,
        });
      }
    }
  });
  // console.log(places);
  return places;
});

// Retrieves the full wikipedia page for a given title
exports.getFullPage = (title) => {
  title = title.split(' ').join('_');
  const url = `https://en.wikipedia.org/wiki/${title}`;
  // console.log(url);
  return scrapeIt(url, {
    title: 'h1',
    paragraph: 'p',
  });
};

// Retrieves the neighboorhood map using a wikipedia Sparql query
exports.getNeighborhoodMap = (lat, long) => {
  const endpointUrl = 'https://query.wikidata.org/sparql';


  const sparqlQuery = `#defaultView:Map{"layer":"?instance_ofLabel"}
      SELECT ?place ?placeLabel ?image ?coordinate_location ?dist ?instance_of ?instance_ofLabel WHERE {
        SERVICE wikibase:around {
          ?place wdt:P625 ?coordinate_location.
          bd:serviceParam wikibase:center "Point(${long} ${lat})"^^geo:wktLiteral .
          bd:serviceParam wikibase:radius "1".
          bd:serviceParam wikibase:distance ?dist.
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
        OPTIONAL { ?place wdt:P18 ?image. }
        OPTIONAL { ?place wdt:P31 ?instance_of. }
      }`;


  const fullUrl = `${endpointUrl}?query=${encodeURIComponent(sparqlQuery)}`;


  const headers = {
    Accept: 'application/sparql-results+json',
  };

  fetch(fullUrl, {
    headers,
  }).then(body => body.json()).then((json) => {
    const {
      head: {
        vars,
      },
      results,
    } = json;
    for (const result of results.bindings) {
      for (const variable of vars) {
        console.log('%s: %o', variable, result[variable]);
      }
    }
  });
};

exports.getPOINarrow = (lat, long) => axios.get(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates%7Cpageimages%7Cpageterms%7Cextracts&exlimit=5&generator=geosearch&colimit=1&piprop=thumbnail&pithumbsize=144&pilimit=10&wbptterms=description&ggscoord=${lat}%7C${long}&ggsradius=1500&ggslimit=1`);

// get the address at the current lat and long
// MapQuet API key is required
// https://www.mapquestapi.com/geocoding/v1/reverse?key=KEY&location=29.92878%2C-90.08422&outFormat=json&thumbMaps=false
exports.getAddress = (lat, long) => {
  axios.get(`https://www.mapquestapi.com/geocoding/v1/reverse?key=${process.env.MAPQUESTKEY}&location=${lat}%2C${long}&outFormat=json&thumbMaps=false`)
    .then((res) => {
      // console.log(res.data.results[0].locations[0].street);
      res.send(res.data.results[0].locations[0].street);
    })
    .catch((error) => {
      throw error;
    });
  // https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=1403+Washington+Ave
};

exports.searchByAddress = (add) => {
  add = add.split(' ').join('+');
  axios.get(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${add}+New+Orleans`)
    .then((res) => {
      res.send(res.data.query);
    })
    .catch((error) => {
      throw error;
    });
};

exports.searchByTitle = (title) => {
  title = title.split(' ').join('+');
  axios.get(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${title}`)
    .then((res) => {
      res.send(res.data.query);
    }).catch((error) => {
      throw error;
    });
};

exports.getFullPageURI = (uri, req, res) => {
  scrapeIt(uri, {
    title: 'h1',
    paragraph: 'p',
  })
    .then(({ data }) => {
      let results = data.paragraph.replace(/ *\[[^)]*\] */g, ' ');
      results = results.replace(/[\r\n]/g, '');
      results = results.split('.');
      // console.log(results);
      res.send(results);
    }).catch((error) => {
      throw error;
    });
};
// ///////////////////////////////////////////
//   USER RELATED FUNCTIONS                //
// ///////////////////////////////////////////

exports.loginUser = (user, response, reject) => {
  console.log('login user helper fired');
  // TODO:give me data Senai !

  // the below works but this isn't really the proper place for it
  // possible shift to findAndUPdate or something similar
  // db.findUser(user.body).then((userData)=>{
  //   console.log(`response ${userData}`);
  //   console.log('do whatever we need to do here to log them in');

  // }).catch( (err)=> { console.log(err)});
};

exports.createUser = (user, response, reject) => {
  console.log('create user helper fired');

  db.createUser = (userInfo, sequelize) => {
    (user.body).then((userData) => {
      console.log(`response ${userData}`);
      console.log('do whatever we need to do here to log them in');
      res.end;
    }).catch((err) => {
      console.log(err);
    });
  };
};

// addToUserFavorites
exports.addToFavorites = (favorite, response, reject) => {
  console.log('addToUserFavorites');
  db.addToUserFavorites(favorite).then((response) => {
    console.log('favorite added', response);
    res.end;
  }).catch((reject) => {
    console.log('reject');
  });
};

// ///////////////////////////////////////////////////////
// END OF USER RELATED FUNCTIONS                       //
// ///////////////////////////////////////////////////////


exports.neighborhoodCreate = (neighborhood, response, reject) => {
  console.log('neighborhoodCreate');
  db.createNeighborhood(neighborhood).then((response) => {
    console.log('hood created', response);
    res.end;
  }).catch((reject) => {
    console.log('reject');
  });
};

exports.poiCreate = (poi, response, reject) => {
  console.log('poiCreate');
  db.createPoi(poi).then((response) => {
    console.log('poi created', response);
    res.end;
  }).catch((reject) => {
    console.log('reject');
  });
};

exports.vcsCreate = (vcsInfo, respose, reject) => {
  console.log('vieux carre address entry create fired');
  db.createVcs(vcsInfo).then((response) => {
    console.log('vc data created', response);
    res.end;
  }).catch((reject) => {
    console.log("you\'re a reject");
  });
};
