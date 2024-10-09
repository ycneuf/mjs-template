# jms-template

Moteur de template (très) simple.
Un template est un fragment de document HTML sur lequel on vient appliquer une donnée (généralement un objet).
 
Les templates peuvent être dans le document HTML lui même (ce sont les éléments `<template id="id">`) ou dans des fichiers distincts.
 
La donnée peut être de type `object` ou `scalar` (string, symbol, number, boolean). Les autres types sont interprétés comme `null`.
L'application d'une donnée nulle a un template génère un fragment HTML totalement vide.

## Principe de fonctionnement
 Le moteur de template recherche les éléments du document qui ont l'attribut `template` et/ou l'attribut `template-src`.
 - `template="id"` désigne l'élement `<template id="id">`dans le document HTML
 - `template-src="url"` indique que le template doit être chargé depuis une URL
 L'élément est alors remplacé par l'application de la donnée courante au template.
 
 Nota :  Si les deux attributs sont présents, `template` est priorisé.
 Toutefois, si le template indiqué n'existe pas, le moteur utilisera l'attribut `template-src`.
 
 Pour définir la donnée courante, il faut utiliser soit l'attribut `template-data`, soit l'attribute `template-data-src`.
 - `template-data="expression"` : la donnée courante est le résultat de l'évaluation de `expression``  
 - `template-data-src="url"` : la données courante est chargée depuis l'URL (format Json)
 Lors de l'application de la donnée au template, les motifs `{expression}` dans les attributs ou dans les noeuds texte sont remplacés par le résultat de l'évaluation
 de l'expression.
 L'expression doit être une expression javascript valide.
 Elle est evaluée dans la portée globale (donc `window`, `document` et toutes les variables globales sont accessibles).
 La variable `this` contient la donnée courante.
  
 A l'intérieur du template, deux attributs sont disponibles.
 - `template-if="{expression}"`: ne traite l'élément que si l'expression a la valeur `true`, ou équivalente. Sinon, cet élément est ignoré.
 - `template-foreach="{expression}"` : si le résultat de l'évaluation de l'expression est un [itérable](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Iteration_protocols),
 clone l'élément pour chaque item de l'itérable. Sinon ignore l'élément.
  
 Il est bien évidemment possible, à l'intérieur d'un template, de redéfinir la donnée courante avec `template-data` et `template-data-src` ou même de refaire un templating interne avec `template` ou `template-src`.
 
